use std::path::PathBuf;

/// Core error type for circomkit-core operations.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    #[error("circuit '{0}' not found in config")]
    CircuitNotFound(String),

    #[error("invalid protocol '{0}': expected groth16, plonk, or fflonk")]
    InvalidProtocol(String),

    #[error("invalid prime '{0}'")]
    InvalidPrime(String),

    #[error("invalid R1CS file: {0}")]
    InvalidR1cs(String),

    #[error("invalid witness file: {0}")]
    InvalidWitness(String),

    #[error("invalid symbols file: {0}")]
    InvalidSymbols(String),

    #[error("compilation failed: {0}")]
    CompilationFailed(String),

    #[error("PLONK protocol requires optimization level 1")]
    PlonkOptimization,

    #[error("PTAU not found and auto-download is unavailable for prime '{0}'")]
    PtauUnavailable(String),

    #[error("PTAU download failed: {0}")]
    PtauDownloadFailed(String),

    #[error("file not found: {}", .0.display())]
    FileNotFound(PathBuf),

    #[error("signal not found: {0}")]
    SignalNotFound(String),

    #[error("config validation failed: {0}")]
    ConfigValidation(String),

    #[error("invalid calldata value: {0}")]
    InvalidCalldata(String),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, CoreError>;
