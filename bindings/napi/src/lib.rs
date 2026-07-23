//! Node.js (napi-rs) bindings for Circomkit.
//!
//! Exposes a `Circomkit` class mirroring the Rust orchestrator. Methods are
//! synchronous (matching Circomkit's design); circuit inputs and inline config
//! cross the boundary as JSON strings. All Rust errors surface as JS exceptions.

use std::path::{Path, PathBuf};
use std::str::FromStr;

use circomkit::Circomkit as Inner;
use circomkit::{CircuitSignals, ProvingBackendKind};
use napi_derive::napi;

/// Convert any `Display` error into a napi (JS) error.
fn err<E: std::fmt::Display>(e: E) -> napi::Error {
    napi::Error::from_reason(e.to_string())
}

/// Render a path as a lossy UTF-8 string for the JS side.
fn path_string(p: PathBuf) -> String {
    p.to_string_lossy().into_owned()
}

/// Parse an optional JSON string of circuit signals into `CircuitSignals`.
fn parse_signals(data: Option<String>) -> napi::Result<Option<CircuitSignals>> {
    match data {
        Some(json) => Ok(Some(serde_json::from_str(&json).map_err(err)?)),
        None => Ok(None),
    }
}

/// Parse a required JSON string of circuit signals.
fn signals_from_json(json: &str) -> napi::Result<CircuitSignals> {
    serde_json::from_str(json).map_err(err)
}

/// Parse a JSON object of `symbol -> value` overrides into BigInts. Values may
/// be decimal strings or JSON integers.
fn bigint_map_from_json(
    json: &str,
) -> napi::Result<std::collections::HashMap<String, num_bigint::BigInt>> {
    let raw: std::collections::HashMap<String, serde_json::Value> =
        serde_json::from_str(json).map_err(err)?;
    let mut out = std::collections::HashMap::with_capacity(raw.len());
    for (k, v) in raw {
        let bi = match v {
            serde_json::Value::String(s) => s.parse::<num_bigint::BigInt>().map_err(err)?,
            serde_json::Value::Number(n) => {
                n.to_string().parse::<num_bigint::BigInt>().map_err(err)?
            }
            other => return Err(err(format!("invalid override value for `{k}`: {other}"))),
        };
        out.insert(k, bi);
    }
    Ok(out)
}

/// Map a core `R1CSInfo` into the napi object.
fn r1cs_info_to_napi(i: circomkit::R1CSInfo) -> R1csInfo {
    R1csInfo {
        wires: i.wires,
        constraints: i.constraints,
        private_inputs: i.private_inputs,
        public_inputs: i.public_inputs,
        public_outputs: i.public_outputs,
        uses_custom_gates: i.uses_custom_gates,
        labels: i.labels as i64,
        prime: i.prime.to_string(),
        prime_name: i.prime_name.map(|p| p.to_string()),
    }
}

/// R1CS metadata (returned by [`Circomkit::info`]).
#[napi(object)]
pub struct R1csInfo {
    pub wires: u32,
    pub constraints: u32,
    pub private_inputs: u32,
    pub public_inputs: u32,
    pub public_outputs: u32,
    pub uses_custom_gates: bool,
    /// Total label count.
    pub labels: i64,
    /// Field prime as a decimal string.
    pub prime: String,
    /// Human-readable prime name (e.g. `"bn128"`), if recognized.
    pub prime_name: Option<String>,
}

/// Result of a trusted setup (returned by [`Circomkit::setup`]).
#[napi(object)]
pub struct SetupResult {
    pub pkey_path: String,
    pub vkey_path: String,
}

/// A Circom development & testing toolkit instance.
#[napi]
pub struct Circomkit {
    inner: Inner,
}

#[napi]
impl Circomkit {
    /// Load Circomkit from a `circomkit.json` file.
    #[napi(factory)]
    pub fn from_file(path: String) -> napi::Result<Self> {
        Ok(Self {
            inner: Inner::from_file(&path).map_err(err)?,
        })
    }

    /// Load Circomkit from a JSON config string.
    ///
    /// Auto-detects and converts the legacy Circomkit v0.3 flat config format.
    /// Relative paths it references resolve against the current directory.
    #[napi(factory)]
    pub fn from_config(json: String) -> napi::Result<Self> {
        let config =
            circomkit::CircomkitConfig::from_json_str(&json, Path::new(".")).map_err(err)?;
        Ok(Self {
            inner: Inner::new(config).map_err(err)?,
        })
    }

    /// The active config, normalized to the v0.4 nested format, as a JSON string.
    ///
    /// Lets the TypeScript facade read back a legacy config after conversion so
    /// later inline-tester merges operate on the canonical shape.
    #[napi]
    pub fn config_json(&self) -> napi::Result<String> {
        serde_json::to_string(&self.inner.config).map_err(err)
    }

    /// Generate the main component `.circom` file for a circuit. Returns its path.
    #[napi]
    pub fn instantiate(&self, circuit: String) -> napi::Result<String> {
        Ok(path_string(self.inner.instantiate(&circuit).map_err(err)?))
    }

    /// Compile a circuit (auto-instantiating if needed). Returns the build dir.
    #[napi]
    pub fn compile(&self, circuit: String) -> napi::Result<String> {
        Ok(path_string(self.inner.compile(&circuit).map_err(err)?))
    }

    /// Read R1CS metadata (wires, constraints, I/O counts, prime).
    #[napi]
    pub fn info(&self, circuit: String) -> napi::Result<R1csInfo> {
        Ok(r1cs_info_to_napi(self.inner.info(&circuit).map_err(err)?))
    }

    /// Create a `WitnessTester` for a circuit (compiles it first if needed).
    #[napi]
    pub fn witness_tester(&self, circuit: String) -> napi::Result<WitnessTester> {
        let config = self
            .inner
            .config
            .circuits
            .get(&circuit)
            .ok_or_else(|| err(format!("circuit `{circuit}` not found in config")))?
            .clone();
        let inner = self.inner.witness_tester(&circuit, config).map_err(err)?;
        Ok(WitnessTester { inner })
    }

    /// Create a `ProofTester` for a circuit and protocol
    /// (`"groth16" | "plonk" | "fflonk"`). Run `setup` first.
    #[napi]
    pub fn proof_tester(&self, circuit: String, protocol: String) -> napi::Result<ProofTester> {
        let proto = match protocol.as_str() {
            "groth16" => circomkit::Protocol::Groth16,
            "plonk" => circomkit::Protocol::Plonk,
            "fflonk" => circomkit::Protocol::Fflonk,
            other => return Err(err(format!("unknown protocol `{other}`"))),
        };
        let inner = self.inner.proof_tester(&circuit, proto).map_err(err)?;
        Ok(ProofTester { inner })
    }

    /// Remove all build artifacts for a circuit.
    #[napi]
    pub fn clear(&self, circuit: String) -> napi::Result<()> {
        self.inner.clear(&circuit).map_err(err)
    }

    /// Get or download the PTAU file for a circuit. Returns its path.
    #[napi]
    pub fn ptau(&self, circuit: String) -> napi::Result<String> {
        Ok(path_string(self.inner.ptau(&circuit).map_err(err)?))
    }

    /// Run trusted setup. `ptauPath` is optional (auto-downloaded for bn128).
    #[napi]
    pub fn setup(&self, circuit: String, ptau_path: Option<String>) -> napi::Result<SetupResult> {
        let out = self
            .inner
            .setup(&circuit, ptau_path.as_deref().map(Path::new))
            .map_err(err)?;
        Ok(SetupResult {
            pkey_path: path_string(out.pkey_path),
            vkey_path: path_string(out.vkey_path),
        })
    }

    /// Export the verification key. Returns its path.
    #[napi]
    pub fn vkey(&self, circuit: String) -> napi::Result<String> {
        Ok(path_string(self.inner.vkey(&circuit).map_err(err)?))
    }

    /// Export the Solidity verifier contract. Returns its path.
    #[napi]
    pub fn contract(&self, circuit: String) -> napi::Result<String> {
        Ok(path_string(self.inner.contract(&circuit).map_err(err)?))
    }

    /// Compute a witness. `data` is an optional JSON string of input signals
    /// (falls back to `inputs/{circuit}/{input}.json` when omitted). Returns
    /// the witness file path.
    #[napi]
    pub fn witness(
        &self,
        circuit: String,
        input: String,
        data: Option<String>,
    ) -> napi::Result<String> {
        let signals = parse_signals(data)?;
        Ok(path_string(
            self.inner
                .witness(&circuit, &input, signals.as_ref())
                .map_err(err)?,
        ))
    }

    /// Generate a proof. `data` is optional inline signals (JSON string);
    /// `backend` optionally overrides the configured prover
    /// (`"snarkjs" | "arkworks" | "lambdaworks"`). Returns the proof path.
    #[napi]
    pub fn prove(
        &self,
        circuit: String,
        input: String,
        data: Option<String>,
        backend: Option<String>,
    ) -> napi::Result<String> {
        let signals = parse_signals(data)?;
        let kind = match backend {
            Some(b) => Some(ProvingBackendKind::from_str(&b).map_err(err)?),
            None => None,
        };
        Ok(path_string(
            self.inner
                .prove(&circuit, &input, signals.as_ref(), kind)
                .map_err(err)?,
        ))
    }

    /// Verify a previously generated proof.
    #[napi]
    pub fn verify(&self, circuit: String, input: String) -> napi::Result<bool> {
        self.inner.verify(&circuit, &input).map_err(err)
    }

    /// Export Solidity calldata for a proof as a string.
    #[napi]
    pub fn calldata(
        &self,
        circuit: String,
        input: String,
        pretty: Option<bool>,
    ) -> napi::Result<String> {
        self.inner
            .calldata(&circuit, &input, pretty.unwrap_or(false))
            .map_err(err)
    }

    /// Load the input signals for a circuit as a JSON string.
    #[napi]
    pub fn load_input(&self, circuit: String, input: String) -> napi::Result<String> {
        let signals = self.inner.load_input(&circuit, &input).map_err(err)?;
        serde_json::to_string(&signals).map_err(err)
    }
}

/// An opaque handle to a computed witness (a vector of field elements).
///
/// Produced by [`WitnessTester::calculate_witness`] / `edit_witness` and
/// consumed by `edit_witness` / `read_witness*`. The values stay on the Rust
/// side unless read explicitly, so the soundness flow (compute → edit → assert)
/// never converts the whole witness.
#[napi(js_name = "Witness")]
pub struct WitnessHandle {
    inner: circomkit::Witness,
}

/// Witness-level circuit tester (constructed via `Circomkit.witnessTester`).
#[napi]
pub struct WitnessTester {
    inner: circomkit::WitnessTester,
}

#[napi]
impl WitnessTester {
    /// Assert the input produces a valid witness.
    #[napi]
    pub fn expect_pass(&self, input: String) -> napi::Result<()> {
        self.inner
            .expect_pass(&signals_from_json(&input)?)
            .map_err(err)
    }

    /// Assert the input passes and its output signals match `output` (JSON string).
    #[napi]
    pub fn expect_pass_with(&self, input: String, output: String) -> napi::Result<()> {
        self.inner
            .expect_pass_with(&signals_from_json(&input)?, &signals_from_json(&output)?)
            .map_err(err)
    }

    /// Assert the input is rejected; returns the circuit error message.
    #[napi]
    pub fn expect_fail(&self, input: String) -> napi::Result<String> {
        self.inner
            .expect_fail(&signals_from_json(&input)?)
            .map_err(err)
    }

    /// Assert the constraint count (exact, or a lower bound when `exact` is false).
    #[napi]
    pub fn expect_constraint_count(&self, count: u32, exact: bool) -> napi::Result<()> {
        self.inner
            .expect_constraint_count(count, exact)
            .map_err(err)
    }

    /// The circuit's constraint count.
    #[napi]
    pub fn constraint_count(&self) -> napi::Result<u32> {
        self.inner.constraint_count().map_err(err)
    }

    /// R1CS metadata for the circuit.
    #[napi]
    pub fn r1cs_info(&self) -> napi::Result<R1csInfo> {
        Ok(r1cs_info_to_napi(self.inner.r1cs_info().map_err(err)?))
    }

    /// Compute a witness and read the named output signals (JSON string).
    #[napi]
    pub fn compute(&self, input: String, signals: Vec<String>) -> napi::Result<String> {
        let names: Vec<&str> = signals.iter().map(String::as_str).collect();
        let out = self
            .inner
            .compute(&signals_from_json(&input)?, &names)
            .map_err(err)?;
        serde_json::to_string(&out).map_err(err)
    }

    /// Compute a witness handle from inputs (for soundness testing).
    #[napi]
    pub fn calculate_witness(&self, input: String) -> napi::Result<WitnessHandle> {
        let w = self
            .inner
            .calculate_witness(&signals_from_json(&input)?)
            .map_err(err)?;
        Ok(WitnessHandle { inner: w })
    }

    /// Return a new witness with the given `symbol -> value` overrides applied
    /// (values as decimal strings or integers). A tampered witness that still
    /// satisfies the constraints means the circuit is under-constrained.
    #[napi]
    pub fn edit_witness(
        &self,
        witness: &WitnessHandle,
        overrides: String,
    ) -> napi::Result<WitnessHandle> {
        let ov = bigint_map_from_json(&overrides)?;
        let w = self.inner.edit_witness(&witness.inner, &ov).map_err(err)?;
        Ok(WitnessHandle { inner: w })
    }

    /// Read named signal values from a witness handle (JSON string).
    #[napi]
    pub fn read_witness_signals(
        &self,
        witness: &WitnessHandle,
        signals: Vec<String>,
    ) -> napi::Result<String> {
        let names: Vec<&str> = signals.iter().map(String::as_str).collect();
        let out = self
            .inner
            .read_witness_signals(&witness.inner, &names)
            .map_err(err)?;
        serde_json::to_string(&out).map_err(err)
    }

    /// Read raw values from a witness handle by full symbol name (JSON string of
    /// `symbol -> decimal string`).
    #[napi]
    pub fn read_witness(
        &self,
        witness: &WitnessHandle,
        symbols: Vec<String>,
    ) -> napi::Result<String> {
        let names: Vec<&str> = symbols.iter().map(String::as_str).collect();
        let out = self
            .inner
            .read_witness(&witness.inner, &names)
            .map_err(err)?;
        let map: std::collections::HashMap<String, String> =
            out.into_iter().map(|(k, v)| (k, v.to_string())).collect();
        serde_json::to_string(&map).map_err(err)
    }
}

/// Proof-level circuit tester (constructed via `Circomkit.proofTester`; run
/// `setup` first).
#[napi]
pub struct ProofTester {
    inner: circomkit::ProofTester,
}

#[napi]
impl ProofTester {
    /// Generate a proof. Returns `{ proof, publicSignals }` as a JSON string.
    #[napi]
    pub fn prove(&self, input: String) -> napi::Result<String> {
        let out = self.inner.prove(&signals_from_json(&input)?).map_err(err)?;
        serde_json::to_string(&serde_json::json!({
            "proof": out.proof,
            "publicSignals": out.public_signals,
        }))
        .map_err(err)
    }

    /// Verify a proof (proof as a JSON string, plus its public signals).
    #[napi]
    pub fn verify(&self, proof: String, public_signals: Vec<String>) -> napi::Result<bool> {
        let proof_val: serde_json::Value = serde_json::from_str(&proof).map_err(err)?;
        self.inner.verify(&proof_val, &public_signals).map_err(err)
    }

    /// Assert verification passes.
    #[napi]
    pub fn expect_pass(&self, proof: String, public_signals: Vec<String>) -> napi::Result<()> {
        let proof_val: serde_json::Value = serde_json::from_str(&proof).map_err(err)?;
        self.inner
            .expect_pass(&proof_val, &public_signals)
            .map_err(err)
    }

    /// Assert verification fails.
    #[napi]
    pub fn expect_fail(&self, proof: String, public_signals: Vec<String>) -> napi::Result<()> {
        let proof_val: serde_json::Value = serde_json::from_str(&proof).map_err(err)?;
        self.inner
            .expect_fail(&proof_val, &public_signals)
            .map_err(err)
    }
}
