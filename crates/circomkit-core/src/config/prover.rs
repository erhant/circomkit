use std::path::PathBuf;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::enums::{Protocol, ProvingBackendKind};

/// Groth16-specific prover options.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(default, rename_all = "camelCase")]
pub struct Groth16Options {
    /// Number of phase-2 contributions.
    pub num_contributions: u32,
    /// Whether to prompt for entropy during contributions.
    pub ask_for_entropy: bool,
}

impl Default for Groth16Options {
    fn default() -> Self {
        Self {
            num_contributions: 1,
            ask_for_entropy: false,
        }
    }
}

/// Prover configuration.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(default, rename_all = "camelCase")]
pub struct ProverConfig {
    /// Proof protocol to use.
    pub protocol: Protocol,
    /// Proving backend.
    pub backend: ProvingBackendKind,
    /// Whether snarkjs should log verbosely.
    pub verbose: bool,
    /// Directory for Powers of Tau files.
    pub ptau_dir: PathBuf,
    /// Directory for circuit input JSON files.
    pub input_dir: PathBuf,
    /// Groth16-specific options.
    pub groth16: Groth16Options,
}

impl Default for ProverConfig {
    fn default() -> Self {
        Self {
            protocol: Protocol::Groth16,
            backend: ProvingBackendKind::default(),
            verbose: true,
            ptau_dir: PathBuf::from("./ptau"),
            input_dir: PathBuf::from("./inputs"),
            groth16: Groth16Options::default(),
        }
    }
}
