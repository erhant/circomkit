/// Errors that can occur during witness calculation.
#[derive(Debug, thiserror::Error)]
pub enum WitnessError {
    #[error("assertion failed in circuit: {0}")]
    AssertionFailed(String),

    #[error("not enough values for input signal: {0}")]
    NotEnoughInputs(String),

    #[error("too many values for input signal: {0}")]
    TooManyInputs(String),

    #[error("not all inputs have been set")]
    MissingInputs,

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Other(String),
}

impl WitnessError {
    /// Returns `true` if this is an expected circuit-level failure
    /// (assertion, input mismatch) rather than an infrastructure error.
    pub fn is_circuit_error(&self) -> bool {
        matches!(
            self,
            Self::AssertionFailed(_)
                | Self::NotEnoughInputs(_)
                | Self::TooManyInputs(_)
                | Self::MissingInputs
        )
    }
}
