mod compile;
mod prove;
mod testing;

use std::path::Path;

use circomkit_core::config::{CircomkitConfig, ResolvedCircuitConfig};
use circomkit_core::error::{CoreError, Result};
use circomkit_core::pathing::CircomkitPaths;
use circomkit_core::types::CircuitSignals;
use circomkit_prove::SnarkjsBackend;

/// The main orchestrator for Circomkit operations.
///
/// Holds the configuration and provides high-level methods for the full
/// circuit development lifecycle: compile, setup, prove, verify, and test.
pub struct Circomkit {
    pub config: CircomkitConfig,
    pub paths: CircomkitPaths,
}

impl Circomkit {
    /// Create a new Circomkit instance from a config.
    pub fn new(config: CircomkitConfig) -> Result<Self> {
        config.validate()?;
        let paths = CircomkitPaths::new(&config);
        Ok(Self { config, paths })
    }

    /// Load Circomkit from a `circomkit.json` file.
    pub fn from_file(path: impl AsRef<Path>) -> Result<Self> {
        let config = CircomkitConfig::from_file(path)?;
        Self::new(config)
    }

    /// Resolve a circuit's config (merging per-circuit overrides with global).
    pub(crate) fn resolve(&self, circuit: &str) -> Result<ResolvedCircuitConfig> {
        self.config.resolve_circuit(circuit)
    }

    /// Create a SnarkjsBackend for the current protocol.
    pub(crate) fn snarkjs(&self) -> SnarkjsBackend {
        SnarkjsBackend::new("snarkjs", self.config.prover.protocol)
    }

    /// Load circuit input signals from the inputs directory.
    ///
    /// Looks for `inputs/{circuit}/{input}.json` first, falling back to the flat
    /// `inputs/{circuit}.json` layout for single-input circuits.
    pub fn load_input(&self, circuit: &str, input: &str) -> Result<CircuitSignals> {
        let path = self.paths.input_json(circuit, input);
        let path = if path.exists() {
            path
        } else {
            let flat = self.paths.input_json_flat(circuit);
            if flat.exists() {
                flat
            } else {
                // Report the primary path — it's the canonical location.
                return Err(CoreError::FileNotFound(path));
            }
        };
        let content = std::fs::read_to_string(&path)?;
        let signals: CircuitSignals = serde_json::from_str(&content)?;
        Ok(signals)
    }
}
