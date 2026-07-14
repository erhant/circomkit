use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::compiler::CompilerConfig;
use super::overrides::partial_config;
use super::prover::ProverConfig;
use crate::enums::{Prime, Protocol, ProvingBackendKind};

/// Per-circuit configuration.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct CircuitConfig {
    /// Path to the circuit template file (relative to `src_dir`, without extension).
    pub file: String,
    /// Name of the circom template to instantiate.
    pub template: String,
    /// Public input signal names.
    #[serde(default)]
    pub pubs: Vec<String>,
    /// Template parameters.
    #[serde(default)]
    pub params: Vec<serde_json::Value>,
    /// Whether the circuit uses custom templates (custom pragma).
    #[serde(default)]
    pub uses_custom_templates: bool,
    /// Per-circuit config overrides.
    #[serde(default)]
    pub overrides: Option<CircuitOverrides>,
}

/// Per-circuit overrides that merge on top of global config.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
#[serde(default, rename_all = "camelCase")]
pub struct CircuitOverrides {
    pub prover: Option<PartialProverConfig>,
    pub compiler: Option<PartialCompilerConfig>,
    pub version: Option<String>,
}

partial_config! {
    #[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
    #[serde(default, rename_all = "camelCase")]
    pub struct PartialProverConfig merges into ProverConfig {
        pub protocol: Protocol,
        pub backend: ProvingBackendKind,
        pub verbose: bool,
        pub ptau_dir: std::path::PathBuf,
        pub input_dir: std::path::PathBuf
    }
}

partial_config! {
    #[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
    #[serde(default, rename_all = "camelCase")]
    pub struct PartialCompilerConfig merges into CompilerConfig {
        pub prime: Prime,
        pub src_dir: std::path::PathBuf,
        pub out_dir: std::path::PathBuf,
        pub optimization: u32,
        pub verbose: bool,
        pub wasm: bool,
        pub sym: bool,
        pub r1cs: bool,
        pub c: bool,
        pub inspect: bool,
        pub recompile: bool
    }
}
