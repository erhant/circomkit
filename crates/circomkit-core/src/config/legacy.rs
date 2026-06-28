//! Backwards compatibility for the original Circomkit v0.3 config format.
//!
//! The old format is a flat JSON with fields like `dirCircuits`, `dirBuild`,
//! `groth16numContributions`, etc., and a `circuits` field pointing to a
//! separate JSON file containing the circuit definitions.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use super::circomkit::CircomkitConfig;
use super::circuit::CircuitConfig;
use super::compiler::CompilerConfig;
use super::prover::{Groth16Options, ProverConfig};
use super::witness::WitnessConfig;
use crate::enums::{LogLevel, Prime, Protocol, ProvingBackendKind, WitnessBackend};
use crate::error::Result;

/// The original Circomkit v0.3 flat config format.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyConfig {
    #[serde(default = "default_protocol")]
    protocol: Protocol,
    #[serde(default = "default_prime")]
    prime: Prime,
    #[serde(default = "default_version")]
    version: String,

    /// Path to a separate circuits.json file.
    #[serde(default = "default_circuits_path")]
    circuits: String,

    #[serde(default = "default_dir_circuits")]
    dir_circuits: PathBuf,
    #[serde(default = "default_dir_inputs")]
    dir_inputs: PathBuf,
    #[serde(default = "default_dir_ptau")]
    dir_ptau: PathBuf,
    #[serde(default = "default_dir_build")]
    dir_build: PathBuf,
    #[serde(default = "default_circom_path")]
    circom_path: String,

    #[serde(default)]
    optimization: Option<u32>,
    #[serde(default = "default_true")]
    inspect: bool,
    #[serde(default = "default_include")]
    include: Vec<PathBuf>,
    #[serde(default = "default_true")]
    verbose: bool,
    #[serde(default = "default_log_level")]
    log_level: LogLevel,

    #[serde(default)]
    c_witness: bool,
    #[serde(default = "default_true")]
    wasm_witness: bool,

    #[serde(default = "default_one")]
    groth16num_contributions: u32,
    #[serde(default)]
    groth16ask_for_entropy: bool,
}

fn default_protocol() -> Protocol {
    Protocol::Groth16
}
fn default_prime() -> Prime {
    Prime::Bn128
}
fn default_version() -> String {
    "2.1.0".to_string()
}
fn default_circuits_path() -> String {
    "./circuits.json".to_string()
}
fn default_dir_circuits() -> PathBuf {
    PathBuf::from("./circuits")
}
fn default_dir_inputs() -> PathBuf {
    PathBuf::from("./inputs")
}
fn default_dir_ptau() -> PathBuf {
    PathBuf::from("./ptau")
}
fn default_dir_build() -> PathBuf {
    PathBuf::from("./build")
}
fn default_circom_path() -> String {
    "circom".to_string()
}
fn default_include() -> Vec<PathBuf> {
    vec![PathBuf::from("./node_modules")]
}
fn default_log_level() -> LogLevel {
    LogLevel::Info
}
fn default_true() -> bool {
    true
}
fn default_one() -> u32 {
    1
}

/// Detect whether a JSON value is in legacy format.
///
/// Legacy configs have top-level `dirCircuits` or `dirBuild` fields.
/// New configs have a nested `compiler` object.
pub fn is_legacy_format(value: &serde_json::Value) -> bool {
    value.get("dirCircuits").is_some()
        || value.get("dirBuild").is_some()
        || value.get("dirPtau").is_some()
        || value.get("dirInputs").is_some()
        || (value.get("circuits").is_some_and(|v| v.is_string()))
}

/// Convert a legacy config JSON into a new `CircomkitConfig`.
///
/// If the legacy config has a `circuits` field pointing to a file path,
/// the circuits are loaded from that file (resolved relative to `config_dir`).
pub fn from_legacy(value: &serde_json::Value, config_dir: &Path) -> Result<CircomkitConfig> {
    let legacy: LegacyConfig = serde_json::from_value(value.clone())?;

    // Load circuits from the external file
    let circuits = load_legacy_circuits(&legacy.circuits, config_dir)?;

    let optimization = legacy.optimization.unwrap_or(1);

    Ok(CircomkitConfig {
        prover: ProverConfig {
            protocol: legacy.protocol,
            backend: ProvingBackendKind::Snarkjs,
            verbose: legacy.verbose,
            ptau_dir: legacy.dir_ptau,
            input_dir: legacy.dir_inputs,
            groth16: Groth16Options {
                num_contributions: legacy.groth16num_contributions,
                ask_for_entropy: legacy.groth16ask_for_entropy,
            },
        },
        compiler: CompilerConfig {
            prime: legacy.prime,
            src_dir: legacy.dir_circuits,
            out_dir: legacy.dir_build,
            include: legacy.include,
            optimization,
            verbose: legacy.verbose,
            wasm: legacy.wasm_witness,
            sym: true,
            r1cs: true,
            c: legacy.c_witness,
            inspect: legacy.inspect,
            circom_path: legacy.circom_path,
            recompile: false,
        },
        witness: WitnessConfig {
            calculator: if legacy.wasm_witness {
                WitnessBackend::Wasm
            } else {
                WitnessBackend::C
            },
        },
        circuits,
        version: legacy.version,
        log_level: legacy.log_level,
    })
}

/// Load circuit configs from a separate JSON file (the v0.3 pattern).
fn load_legacy_circuits(
    circuits_path: &str,
    config_dir: &Path,
) -> Result<HashMap<String, CircuitConfig>> {
    let resolved = config_dir.join(circuits_path);
    if !resolved.exists() {
        log::warn!("legacy circuits file not found: {}", resolved.display());
        return Ok(HashMap::new());
    }

    let contents = std::fs::read_to_string(&resolved)?;
    let circuits: HashMap<String, CircuitConfig> = serde_json::from_str(&contents)?;
    Ok(circuits)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_legacy_format() {
        let legacy = serde_json::json!({
            "protocol": "groth16",
            "prime": "bn128",
            "dirCircuits": "./circuits",
            "dirBuild": "./build",
            "circuits": "./circuits.json"
        });
        assert!(is_legacy_format(&legacy));

        let new = serde_json::json!({
            "compiler": { "prime": "bn128" },
            "prover": { "protocol": "groth16" },
            "circuits": { "mul": { "file": "mul", "template": "Mul" } }
        });
        assert!(!is_legacy_format(&new));
    }

    #[test]
    fn convert_legacy_config() {
        let legacy = serde_json::json!({
            "protocol": "groth16",
            "prime": "bn128",
            "version": "2.1.4",
            "verbose": false,
            "optimization": 2,
            "dirCircuits": "./src/circuits",
            "dirInputs": "./src/inputs",
            "dirPtau": "./ptau",
            "dirBuild": "./out",
            "circuits": "./circuits.json",
            "groth16numContributions": 3,
            "groth16askForEntropy": true,
            "cWitness": true,
            "wasmWitness": false
        });

        // Use a temp dir so we don't need an actual circuits.json
        let config = from_legacy(&legacy, Path::new("/nonexistent")).unwrap();

        assert_eq!(config.prover.protocol, Protocol::Groth16);
        assert_eq!(config.compiler.prime, Prime::Bn128);
        assert_eq!(config.compiler.optimization, 2);
        assert_eq!(config.compiler.src_dir, PathBuf::from("./src/circuits"));
        assert_eq!(config.compiler.out_dir, PathBuf::from("./out"));
        assert_eq!(config.prover.ptau_dir, PathBuf::from("./ptau"));
        assert_eq!(config.prover.groth16.num_contributions, 3);
        assert!(config.prover.groth16.ask_for_entropy);
        assert!(config.compiler.c);
        assert!(!config.compiler.wasm);
        assert_eq!(config.version, "2.1.4");
    }
}
