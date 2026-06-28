/// Errors that can occur during circuit testing.
#[derive(Debug, thiserror::Error)]
pub enum TestError {
    #[error("expected witness computation to fail, but it succeeded")]
    ExpectedFailure,

    #[error("expected at least {expected} constraints, got {actual}")]
    UnderConstrained { expected: u32, actual: u32 },

    #[error("expected exactly {expected} constraints, got {actual}")]
    ConstraintCountMismatch { expected: u32, actual: u32 },

    #[error("expected constraints to fail, but they passed")]
    ExpectedConstraintFailure,

    #[error("output mismatch for signal '{signal}': expected {expected}, got {actual}")]
    OutputMismatch {
        signal: String,
        expected: String,
        actual: String,
    },

    #[error("verification expected to pass, but failed")]
    VerificationExpectedPass,

    #[error("verification expected to fail, but passed")]
    VerificationExpectedFail,

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Json(#[from] serde_json::Error),

    #[error(transparent)]
    Witness(#[from] circomkit_witness::WitnessError),

    #[error(transparent)]
    Prove(#[from] circomkit_prove::ProveError),

    #[error(transparent)]
    Core(#[from] circomkit_core::error::CoreError),
}
