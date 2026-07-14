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
    #[napi(factory)]
    pub fn from_config(json: String) -> napi::Result<Self> {
        let config = serde_json::from_str(&json).map_err(err)?;
        Ok(Self {
            inner: Inner::new(config).map_err(err)?,
        })
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
        let i = self.inner.info(&circuit).map_err(err)?;
        Ok(R1csInfo {
            wires: i.wires,
            constraints: i.constraints,
            private_inputs: i.private_inputs,
            public_inputs: i.public_inputs,
            public_outputs: i.public_outputs,
            uses_custom_gates: i.uses_custom_gates,
            labels: i.labels as i64,
            prime: i.prime.to_string(),
            prime_name: i.prime_name.map(|p| p.to_string()),
        })
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
