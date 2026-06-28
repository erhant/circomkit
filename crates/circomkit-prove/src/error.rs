use circomkit_core::enums::{Prime, Protocol};

/// Errors that can occur during proving operations.
#[derive(Debug, thiserror::Error)]
pub enum ProveError {
    #[error("proving failed: {0}")]
    ProvingFailed(String),

    #[error("verification failed: {0}")]
    VerificationFailed(String),

    #[error("setup failed: {0}")]
    SetupFailed(String),

    #[error("snarkjs subprocess failed: {0}")]
    SnarkjsError(String),

    #[error("backend `{backend}` does not support protocol `{protocol}` (supported: {supported})")]
    UnsupportedProtocol {
        backend: &'static str,
        protocol: Protocol,
        supported: String,
    },

    #[error("backend `{backend}` does not support curve `{prime}` (supported: {supported})")]
    UnsupportedCurve {
        backend: &'static str,
        prime: Prime,
        supported: String,
    },

    #[error(
        "backend `{backend}` is not enabled; rebuild circomkit-prove with the `{feature}` feature"
    )]
    BackendNotEnabled {
        backend: &'static str,
        feature: &'static str,
    },

    #[error(transparent)]
    Core(#[from] circomkit_core::error::CoreError),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Json(#[from] serde_json::Error),
}
