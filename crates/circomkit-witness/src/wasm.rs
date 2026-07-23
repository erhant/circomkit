use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use num_bigint::BigInt;
use num_traits::Zero;
use wasmtime::{Engine, Instance, Linker, Module, Store};

use circomkit_core::types::{CircuitSignals, SignalValue, Witness};

use crate::error::WitnessError;
use crate::traits::WitnessCalculator;

/// WASM-based witness calculator using wasmtime.
///
/// Loads a circom-generated WASM module and implements the circom
/// witness calculation protocol (shared RW memory, FNV signal hashing, etc.).
///
/// Compiling the WASM module (wasmtime's Cranelift JIT) is by far the most
/// expensive step, so the compiled [`Module`], its [`Engine`], and the host
/// [`Linker`] are built once (lazily, on the first `calculate`) and reused
/// across every subsequent witness computation on this calculator — only a
/// fresh [`Store`]/[`Instance`] is created per call.
pub struct WasmWitnessCalculator {
    wasm_path: PathBuf,
    prepared: OnceLock<Prepared>,
}

/// Compiled, reusable wasmtime artifacts (see [`WasmWitnessCalculator`]).
struct Prepared {
    engine: Engine,
    module: Module,
    linker: Linker<HostState>,
}

impl WasmWitnessCalculator {
    pub fn new(wasm_path: PathBuf) -> Result<Self, WitnessError> {
        if !wasm_path.exists() {
            return Err(WitnessError::Other(format!(
                "WASM file not found: {}",
                wasm_path.display()
            )));
        }
        Ok(Self {
            wasm_path,
            prepared: OnceLock::new(),
        })
    }

    /// Compiled module + linker, built once and cached for reuse.
    ///
    /// Uses a manual get-or-init (stable `OnceLock` has no fallible init): a
    /// benign race may build twice, but the result is identical and idempotent.
    fn prepared(&self) -> Result<&Prepared, WitnessError> {
        if let Some(p) = self.prepared.get() {
            return Ok(p);
        }
        let prepared = Self::build(&self.wasm_path)?;
        let _ = self.prepared.set(prepared);
        Ok(self.prepared.get().expect("prepared was just set"))
    }

    /// Create the engine, JIT-compile the module, and build the host linker.
    fn build(wasm_path: &Path) -> Result<Prepared, WitnessError> {
        let engine = Engine::default();
        let module = Module::from_file(&engine, wasm_path)
            .map_err(|e| WitnessError::Other(format!("failed to load WASM module: {e}")))?;

        let mut linker = Linker::<HostState>::new(&engine);
        register_runtime(&mut linker)?;

        Ok(Prepared {
            engine,
            module,
            linker,
        })
    }
}

/// Register the circom runtime host functions on a linker (independent of any
/// per-call state, so this is done once when the module is prepared).
fn register_runtime(linker: &mut Linker<HostState>) -> Result<(), WitnessError> {
    linker
        .func_wrap(
            "runtime",
            "exceptionHandler",
            |mut caller: wasmtime::Caller<'_, HostState>, code: i32| {
                caller.data_mut().exception = Some(code as u32);
            },
        )
        .map_err(|e| WitnessError::Other(format!("linker error: {e}")))?;

    linker
        .func_wrap(
            "runtime",
            "printErrorMessage",
            |mut caller: wasmtime::Caller<'_, HostState>| {
                let msg = get_message_from_wasm(&mut caller);
                let state = caller.data_mut();
                state.error_message.push_str(&msg);
                state.error_message.push('\n');
            },
        )
        .map_err(|e| WitnessError::Other(format!("linker error: {e}")))?;

    linker
        .func_wrap(
            "runtime",
            "writeBufferMessage",
            |mut caller: wasmtime::Caller<'_, HostState>| {
                let msg = get_message_from_wasm(&mut caller);
                let state = caller.data_mut();
                if msg == "\n" {
                    log::info!("{}", state.log_buffer);
                    state.log_buffer.clear();
                } else {
                    if !state.log_buffer.is_empty() {
                        state.log_buffer.push(' ');
                    }
                    state.log_buffer.push_str(&msg);
                }
            },
        )
        .map_err(|e| WitnessError::Other(format!("linker error: {e}")))?;

    linker
        .func_wrap(
            "runtime",
            "showSharedRWMemory",
            |_caller: wasmtime::Caller<'_, HostState>| {
                // Debug callback — no-op in production
            },
        )
        .map_err(|e| WitnessError::Other(format!("linker error: {e}")))?;

    Ok(())
}

/// State stored inside the wasmtime Store, shared with host functions.
#[derive(Default)]
struct HostState {
    error_message: String,
    log_buffer: String,
    exception: Option<u32>,
}

impl WitnessCalculator for WasmWitnessCalculator {
    fn calculate(&self, input: &CircuitSignals) -> Result<Witness, WitnessError> {
        // Reuse the cached engine/module/linker; only the store and instance are
        // per-call. This avoids re-compiling the WASM module on every witness.
        let prepared = self.prepared()?;

        let mut store = Store::new(&prepared.engine, HostState::default());

        let instance = prepared
            .linker
            .instantiate(&mut store, &prepared.module)
            .map_err(|e| WitnessError::Other(format!("WASM instantiation failed: {e}")))?;

        // Get metadata
        let n32 = call_i32(&instance, &mut store, "getFieldNumLen32")? as usize;
        let witness_size = call_i32(&instance, &mut store, "getWitnessSize")? as usize;
        let input_size = call_i32(&instance, &mut store, "getInputSize")? as usize;

        // Read the prime
        call_void(&instance, &mut store, "getRawPrime", &[])?;
        let prime = read_shared_field_element(&instance, &mut store, n32)?;

        // Initialize
        call_void(&instance, &mut store, "init", &[wasmtime::Val::I32(1)])?;
        check_exception(&mut store)?;

        // Flatten and set all input signals
        let mut input_counter = 0usize;
        for (name, value) in input {
            let (h_msb, h_lsb) = fnv_hash(name);

            // Get expected signal size from the circuit
            let signal_size = call_export_i32(
                &instance,
                &mut store,
                "getInputSignalSize",
                &[
                    wasmtime::Val::I32(h_msb as i32),
                    wasmtime::Val::I32(h_lsb as i32),
                ],
            )?;

            if signal_size < 0 {
                return Err(WitnessError::Other(format!("signal not found: {name}")));
            }
            let signal_size = signal_size as usize;

            let flat = flatten_signal(value);

            if flat.len() < signal_size {
                return Err(WitnessError::NotEnoughInputs(name.clone()));
            }
            if flat.len() > signal_size {
                return Err(WitnessError::TooManyInputs(name.clone()));
            }

            for (i, val) in flat.iter().enumerate() {
                let normalized = normalize(val, &prime);
                let limbs = bigint_to_u32_array(&normalized, n32);

                // Write to shared RW memory: index j gets limbs[n32-1-j]
                for j in 0..n32 {
                    let write_fn = instance
                        .get_func(&mut store, "writeSharedRWMemory")
                        .ok_or_else(|| {
                            WitnessError::Other("writeSharedRWMemory not found".to_string())
                        })?;
                    write_fn
                        .call(
                            &mut store,
                            &[
                                wasmtime::Val::I32(j as i32),
                                wasmtime::Val::I32(limbs[n32 - 1 - j] as i32),
                            ],
                            &mut [],
                        )
                        .map_err(|e| {
                            WitnessError::Other(format!("writeSharedRWMemory failed: {e}"))
                        })?;
                }

                // Set the input signal
                let result = call_void(
                    &instance,
                    &mut store,
                    "setInputSignal",
                    &[
                        wasmtime::Val::I32(h_msb as i32),
                        wasmtime::Val::I32(h_lsb as i32),
                        wasmtime::Val::I32(i as i32),
                    ],
                );

                if let Err(e) = result {
                    check_exception(&mut store)?;
                    return Err(WitnessError::Other(format!("setInputSignal failed: {e}")));
                }

                check_exception(&mut store)?;
                input_counter += 1;
            }
        }

        if input_counter < input_size {
            return Err(WitnessError::MissingInputs);
        }

        // Read witness
        let mut witness = Vec::with_capacity(witness_size);
        for i in 0..witness_size {
            let get_witness_fn = instance
                .get_func(&mut store, "getWitness")
                .ok_or_else(|| WitnessError::Other("getWitness not found".to_string()))?;
            get_witness_fn
                .call(&mut store, &[wasmtime::Val::I32(i as i32)], &mut [])
                .map_err(|e| WitnessError::Other(format!("getWitness failed: {e}")))?;

            let val = read_shared_field_element(&instance, &mut store, n32)?;
            witness.push(val);
        }

        Ok(witness)
    }
}

// ---- Helper functions ----

/// FNV-1a 64-bit hash of a string, returning (MSB_u32, LSB_u32).
fn fnv_hash(s: &str) -> (u32, u32) {
    let mut hash: u64 = 0xCBF2_9CE4_8422_2325;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x0100_0000_01B3);
    }
    let msb = (hash >> 32) as u32;
    let lsb = hash as u32;
    (msb, lsb)
}

/// Normalize a BigInt modulo prime (result in [0, prime)).
fn normalize(val: &BigInt, prime: &BigInt) -> BigInt {
    let r = val % prime;
    if r < BigInt::zero() { r + prime } else { r }
}

/// Convert a non-negative BigInt into a big-endian array of `size` u32 limbs.
fn bigint_to_u32_array(val: &BigInt, size: usize) -> Vec<u32> {
    let mut res = vec![0u32; size];
    let radix = BigInt::from(0x1_0000_0000u64);
    let mut rem = val.clone();

    for limb in res.iter_mut().rev() {
        if rem.is_zero() {
            break;
        }
        let (q, r) = num_integer_div_rem(&rem, &radix);
        *limb = bigint_to_u32(&r);
        rem = q;
    }

    res
}

fn num_integer_div_rem(a: &BigInt, b: &BigInt) -> (BigInt, BigInt) {
    use num_traits::Signed;
    let q = a / b;
    let r = a - &q * b;
    if r.is_negative() {
        (q - BigInt::from(1), r + b)
    } else {
        (q, r)
    }
}

fn bigint_to_u32(val: &BigInt) -> u32 {
    let (_, bytes) = val.to_bytes_le();
    let mut buf = [0u8; 4];
    let len = bytes.len().min(4);
    buf[..len].copy_from_slice(&bytes[..len]);
    u32::from_le_bytes(buf)
}

/// Read a field element from shared RW memory as a BigInt.
fn read_shared_field_element(
    instance: &Instance,
    store: &mut Store<HostState>,
    n32: usize,
) -> Result<BigInt, WitnessError> {
    let mut arr = vec![0u32; n32];
    let mut results = [wasmtime::Val::I32(0)];
    for j in 0..n32 {
        let read_fn = instance
            .get_func(&mut *store, "readSharedRWMemory")
            .ok_or_else(|| WitnessError::Other("readSharedRWMemory not found".to_string()))?;
        read_fn
            .call(&mut *store, &[wasmtime::Val::I32(j as i32)], &mut results)
            .map_err(|e| WitnessError::Other(format!("readSharedRWMemory failed: {e}")))?;
        arr[n32 - 1 - j] = results[0].unwrap_i32() as u32;
    }

    Ok(from_u32_array_be(&arr))
}

/// Convert a big-endian u32 array to BigInt.
fn from_u32_array_be(arr: &[u32]) -> BigInt {
    let mut result = BigInt::zero();
    let radix = BigInt::from(0x1_0000_0000u64);
    for &limb in arr {
        result = result * &radix + BigInt::from(limb);
    }
    result
}

/// Flatten a SignalValue into a list of BigInt values.
fn flatten_signal(value: &SignalValue) -> Vec<BigInt> {
    match value {
        SignalValue::Single(v) => vec![v.clone()],
        SignalValue::Array(arr) => arr.iter().flat_map(flatten_signal).collect(),
    }
}

/// Get the message string from WASM by repeatedly calling `getMessageChar`.
fn get_message_from_wasm(caller: &mut wasmtime::Caller<'_, HostState>) -> String {
    let get_char = match caller.get_export("getMessageChar") {
        Some(wasmtime::Extern::Func(f)) => f,
        _ => return String::new(),
    };

    let mut msg = String::new();
    let mut results = [wasmtime::Val::I32(0)];
    loop {
        if get_char.call(&mut *caller, &[], &mut results).is_err() {
            break;
        }
        let c = results[0].unwrap_i32() as u32;
        if c == 0 {
            break;
        }
        if let Some(ch) = char::from_u32(c) {
            msg.push(ch);
        }
    }
    msg
}

/// Check if the WASM module raised an exception via the host state.
fn check_exception(store: &mut Store<HostState>) -> Result<(), WitnessError> {
    let state = store.data();
    if let Some(code) = state.exception {
        let detail = if state.error_message.is_empty() {
            String::new()
        } else {
            format!(": {}", state.error_message.trim())
        };

        // Reset
        store.data_mut().exception = None;
        store.data_mut().error_message.clear();

        match code {
            1 => Err(WitnessError::Other(format!("signal not found{detail}"))),
            2 => Err(WitnessError::Other(format!("too many signals set{detail}"))),
            3 => Err(WitnessError::Other(format!("signal already set{detail}"))),
            4 => Err(WitnessError::AssertionFailed(format!(
                "assert failed{detail}"
            ))),
            5 => Err(WitnessError::Other(format!("not enough memory{detail}"))),
            6 => Err(WitnessError::Other(format!(
                "input signal array access exceeds size{detail}"
            ))),
            _ => Err(WitnessError::Other(format!(
                "unknown WASM error (code {code}){detail}"
            ))),
        }
    } else {
        Ok(())
    }
}

// ---- Convenience wrappers for calling WASM exports ----

fn call_void(
    instance: &Instance,
    store: &mut Store<HostState>,
    name: &str,
    args: &[wasmtime::Val],
) -> Result<(), WitnessError> {
    let func = instance
        .get_func(&mut *store, name)
        .ok_or_else(|| WitnessError::Other(format!("WASM export '{name}' not found")))?;
    func.call(&mut *store, args, &mut [])
        .map_err(|e| WitnessError::Other(format!("{name} failed: {e}")))?;
    Ok(())
}

fn call_i32(
    instance: &Instance,
    store: &mut Store<HostState>,
    name: &str,
) -> Result<i32, WitnessError> {
    call_export_i32(instance, store, name, &[])
}

fn call_export_i32(
    instance: &Instance,
    store: &mut Store<HostState>,
    name: &str,
    args: &[wasmtime::Val],
) -> Result<i32, WitnessError> {
    let func = instance
        .get_func(&mut *store, name)
        .ok_or_else(|| WitnessError::Other(format!("WASM export '{name}' not found")))?;
    let mut results = [wasmtime::Val::I32(0)];
    func.call(&mut *store, args, &mut results)
        .map_err(|e| WitnessError::Other(format!("{name} failed: {e}")))?;
    Ok(results[0].unwrap_i32())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fnv_hash_known_values() {
        let (msb, lsb) = fnv_hash("in");
        assert_ne!(msb, 0);
        assert_ne!(lsb, 0);

        // Same input must produce same hash
        let (msb2, lsb2) = fnv_hash("in");
        assert_eq!(msb, msb2);
        assert_eq!(lsb, lsb2);

        // Different inputs produce different hashes
        let (msb3, lsb3) = fnv_hash("out");
        assert!(msb != msb3 || lsb != lsb3);
    }

    #[test]
    fn bigint_to_array_roundtrip() {
        let val = BigInt::from(12345678u64);
        let arr = bigint_to_u32_array(&val, 8);
        let back = from_u32_array_be(&arr);
        assert_eq!(val, back);
    }

    #[test]
    fn bigint_to_array_large() {
        let val = BigInt::from(u64::MAX);
        let arr = bigint_to_u32_array(&val, 8);
        let back = from_u32_array_be(&arr);
        assert_eq!(val, back);
    }

    #[test]
    fn bigint_to_array_zero() {
        let val = BigInt::zero();
        let arr = bigint_to_u32_array(&val, 8);
        assert!(arr.iter().all(|&x| x == 0));
        let back = from_u32_array_be(&arr);
        assert_eq!(val, back);
    }

    #[test]
    fn flatten_nested_signal() {
        let sig = SignalValue::Array(vec![
            SignalValue::Single(BigInt::from(1)),
            SignalValue::Array(vec![
                SignalValue::Single(BigInt::from(2)),
                SignalValue::Single(BigInt::from(3)),
            ]),
        ]);
        let flat = flatten_signal(&sig);
        assert_eq!(
            flat,
            vec![BigInt::from(1), BigInt::from(2), BigInt::from(3)]
        );
    }

    #[test]
    fn normalize_negative() {
        let prime = BigInt::from(7);
        assert_eq!(normalize(&BigInt::from(-1), &prime), BigInt::from(6));
        assert_eq!(normalize(&BigInt::from(0), &prime), BigInt::from(0));
        assert_eq!(normalize(&BigInt::from(10), &prime), BigInt::from(3));
    }
}
