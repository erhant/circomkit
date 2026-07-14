use std::path::PathBuf;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::enums::Prime;

/// Compiler configuration.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(default, rename_all = "camelCase")]
pub struct CompilerConfig {
    /// Prime field for circuit compilation.
    pub prime: Prime,
    /// Source directory for circuit templates.
    pub src_dir: PathBuf,
    /// Output directory for build artifacts.
    pub out_dir: PathBuf,
    /// Include paths for circom (e.g. `node_modules`).
    pub include: Vec<PathBuf>,
    /// Optimization level (0, 1, 2, or higher for O2round).
    pub optimization: u32,
    /// Whether circom should output verbose logs.
    pub verbose: bool,
    /// Generate WASM witness calculator.
    pub wasm: bool,
    /// Generate symbol file.
    pub sym: bool,
    /// Generate R1CS file.
    pub r1cs: bool,
    /// Generate C witness calculator.
    pub c: bool,
    /// Run constraint inspection during compilation.
    pub inspect: bool,
    /// Force recompilation even if build artifacts are up-to-date.
    /// When `false` (default), compilation is skipped if the R1CS file exists
    /// and is newer than the source `.circom` file.
    pub recompile: bool,
}

impl Default for CompilerConfig {
    fn default() -> Self {
        Self {
            prime: Prime::Bn128,
            src_dir: PathBuf::from("./circuits"),
            out_dir: PathBuf::from("./build"),
            include: vec![PathBuf::from("./node_modules")],
            optimization: 1,
            verbose: true,
            wasm: true,
            sym: true,
            r1cs: true,
            c: false,
            inspect: true,
            recompile: false,
        }
    }
}
