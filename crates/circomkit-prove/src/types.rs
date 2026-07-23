use serde::{Deserialize, Serialize};

/// A proof output in snarkjs-compatible format.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProofOutput {
    /// Protocol-specific proof JSON (Groth16, PLONK, or FFLONK format).
    pub proof: serde_json::Value,
    /// Public signals as decimal strings.
    pub public_signals: Vec<String>,
}
