use std::path::PathBuf;
use std::process::Command;

use circomkit_core::types::{CircuitSignals, Witness};
use circomkit_core::utils::parse_witness_file;

use crate::error::WitnessError;
use crate::traits::WitnessCalculator;

/// Witness calculator backed by a circom `--c` compiled native binary.
///
/// The binary is produced at compile time (via `make` in the `{circuit}_cpp`
/// directory). This calculator serializes the inputs to a temporary
/// `input.json`, runs `binary input.json witness.wtns`, and parses the result.
///
/// It is significantly faster than the WASM calculator on large circuits and,
/// being native 64-bit code, is not bound by the wasm32 4 GB memory limit.
pub struct CWitnessCalculator {
    binary_path: PathBuf,
}

impl CWitnessCalculator {
    /// Create a calculator for an already-built C witness binary.
    pub fn new(binary_path: PathBuf) -> Result<Self, WitnessError> {
        if !binary_path.exists() {
            return Err(WitnessError::Other(format!(
                "C witness binary not found: {} (compile the circuit with the C backend first)",
                binary_path.display()
            )));
        }
        Ok(Self { binary_path })
    }
}

impl WitnessCalculator for CWitnessCalculator {
    fn calculate(&self, input: &CircuitSignals) -> Result<Witness, WitnessError> {
        let dir = tempfile::tempdir()?;
        let input_path = dir.path().join("input.json");
        let wtns_path = dir.path().join("witness.wtns");

        let json = serde_json::to_string(input)
            .map_err(|e| WitnessError::Other(format!("failed to serialize inputs: {e}")))?;
        std::fs::write(&input_path, json)?;

        let output = Command::new(&self.binary_path)
            .arg(&input_path)
            .arg(&wtns_path)
            .output()
            .map_err(|e| {
                WitnessError::Other(format!(
                    "failed to run C witness binary {}: {e}",
                    self.binary_path.display()
                ))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            let msg = if stderr.trim().is_empty() {
                stdout.trim().to_string()
            } else {
                stderr.trim().to_string()
            };
            // circom's C witness generator reports assertion/constraint failures
            // (and missing/extra inputs) on a non-zero exit.
            if msg.contains("Assert") || msg.contains("assert") || msg.contains("Error") {
                return Err(WitnessError::AssertionFailed(msg));
            }
            return Err(WitnessError::Other(format!(
                "C witness calculation failed: {msg}"
            )));
        }

        parse_witness_file(&wtns_path)
            .map_err(|e| WitnessError::Other(format!("failed to parse witness file: {e}")))
    }
}
