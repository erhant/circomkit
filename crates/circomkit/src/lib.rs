pub use circomkit_core as core;
pub use circomkit_prove as prove;
pub use circomkit_test as test;
pub use circomkit_witness as witness;

mod circomkit;

pub use circomkit::Circomkit;

// Re-export key types for convenience
pub use circomkit_core::config::{CircomkitConfig, CircuitConfig};
pub use circomkit_core::enums::{Prime, Protocol};
pub use circomkit_core::error::CoreError;
pub use circomkit_core::pathing::CircomkitPaths;
pub use circomkit_core::types::R1CSInfo;
pub use circomkit_core::types::{CircuitSignals, SignalValue, Witness};
pub use circomkit_prove::{ProofOutput, ProvingBackend, SnarkjsBackend};
pub use circomkit_test::{ProofTester, WitnessTester};
pub use circomkit_witness::{WitnessCalculator, WitnessError};

// Re-export the signals! macro
pub use circomkit_core::signals;
