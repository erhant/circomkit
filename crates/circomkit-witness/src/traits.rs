use circomkit_core::types::{CircuitSignals, Witness};

use crate::WitnessError;

/// Trait for witness calculators that compute a witness from circuit inputs.
pub trait WitnessCalculator {
    /// Calculate a witness from circuit input signals.
    fn calculate(&self, input: &CircuitSignals) -> Result<Witness, WitnessError>;
}
