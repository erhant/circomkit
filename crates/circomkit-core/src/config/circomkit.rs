use std::collections::HashMap;
use std::path::Path;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::circuit::CircuitConfig;
use super::compiler::CompilerConfig;
use super::prover::ProverConfig;
use super::witness::WitnessConfig;
use crate::enums::{LogLevel, Protocol};
use crate::error::{CoreError, Result};

/// Top-level circomkit configuration.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(default, rename_all = "camelCase")]
pub struct CircomkitConfig {
    /// Prover settings.
    pub prover: ProverConfig,
    /// Compiler settings.
    pub compiler: CompilerConfig,
    /// Witness generation settings.
    pub witness: WitnessConfig,
    /// Circuit definitions, keyed by circuit name.
    pub circuits: HashMap<String, CircuitConfig>,
    /// Circom version for pragma.
    pub version: String,
    /// Log level.
    pub log_level: LogLevel,
}

impl Default for CircomkitConfig {
    fn default() -> Self {
        Self {
            prover: ProverConfig::default(),
            compiler: CompilerConfig::default(),
            witness: WitnessConfig::default(),
            circuits: HashMap::new(),
            version: "2.1.0".to_string(),
            log_level: LogLevel::default(),
        }
    }
}

/// A circuit config with global settings resolved (overrides merged).
#[derive(Debug, Clone)]
pub struct ResolvedCircuitConfig {
    pub circuit: CircuitConfig,
    pub prover: ProverConfig,
    pub compiler: CompilerConfig,
    pub version: String,
}

impl CircomkitConfig {
    /// Load config from a JSON file, falling back to defaults for missing fields.
    ///
    /// Automatically detects the legacy Circomkit v0.3 flat config format
    /// and converts it to the new nested format.
    pub fn from_file(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        if !path.exists() {
            return Ok(Self::default());
        }
        let contents = std::fs::read_to_string(path)?;
        let value: serde_json::Value = serde_json::from_str(&contents)?;

        let config = if super::legacy::is_legacy_format(&value) {
            log::info!("detected legacy Circomkit v0.3 config format, converting...");
            let config_dir = path.parent().unwrap_or(Path::new("."));
            super::legacy::from_legacy(&value, config_dir)?
        } else {
            serde_json::from_value(value)?
        };

        config.validate()?;
        Ok(config)
    }

    /// Validate the configuration.
    pub fn validate(&self) -> Result<()> {
        if self.prover.protocol == Protocol::Plonk && self.compiler.optimization != 1 {
            return Err(CoreError::PlonkOptimization);
        }
        Ok(())
    }

    /// Resolve a circuit config by name, merging per-circuit overrides with global settings.
    pub fn resolve_circuit(&self, name: &str) -> Result<ResolvedCircuitConfig> {
        let circuit = self
            .circuits
            .get(name)
            .ok_or_else(|| CoreError::CircuitNotFound(name.to_string()))?;

        let mut prover = self.prover.clone();
        let mut compiler = self.compiler.clone();
        let mut version = self.version.clone();

        if let Some(overrides) = &circuit.overrides {
            if let Some(p) = &overrides.prover {
                p.merge_into(&mut prover);
            }
            if let Some(c) = &overrides.compiler {
                c.merge_into(&mut compiler);
            }
            if let Some(v) = &overrides.version {
                version = v.clone();
            }
        }

        Ok(ResolvedCircuitConfig {
            circuit: circuit.clone(),
            prover,
            compiler,
            version,
        })
    }

    /// Generate the JSON Schema for this config.
    pub fn json_schema() -> schemars::schema::RootSchema {
        schemars::schema_for!(CircomkitConfig)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::circuit::{CircuitOverrides, PartialCompilerConfig};
    use crate::enums::Prime;

    #[test]
    fn default_config_is_valid() {
        let config = CircomkitConfig::default();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn plonk_requires_opt_1() {
        let mut config = CircomkitConfig::default();
        config.prover.protocol = Protocol::Plonk;
        config.compiler.optimization = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn circuit_overrides_merge() {
        let mut config = CircomkitConfig::default();
        config.circuits.insert(
            "test".to_string(),
            CircuitConfig {
                file: "test".to_string(),
                template: "Test".to_string(),
                pubs: vec![],
                params: vec![],
                uses_custom_templates: false,
                overrides: Some(CircuitOverrides {
                    compiler: Some(PartialCompilerConfig {
                        optimization: Some(2),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
            },
        );

        let resolved = config.resolve_circuit("test").unwrap();
        assert_eq!(resolved.compiler.optimization, 2);
        assert_eq!(resolved.compiler.prime, Prime::Bn128);
    }

    #[test]
    fn circuit_not_found() {
        let config = CircomkitConfig::default();
        assert!(config.resolve_circuit("nonexistent").is_err());
    }

    #[test]
    fn roundtrip_json() {
        let config = CircomkitConfig::default();
        let json = serde_json::to_string_pretty(&config).unwrap();
        let parsed: CircomkitConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.version, config.version);
        assert_eq!(parsed.prover.protocol, config.prover.protocol);
    }

    #[test]
    fn json_schema_generates() {
        let schema = CircomkitConfig::json_schema();
        let json = serde_json::to_string_pretty(&schema).unwrap();
        assert!(json.contains("CircomkitConfig"));
    }

    #[test]
    #[ignore = "run manually to generate schema: cargo test -p circomkit-core generate_schema -- --ignored"]
    fn generate_schema() {
        let schema = CircomkitConfig::json_schema();
        let json = serde_json::to_string_pretty(&schema).unwrap();
        let out_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join("schema.json");
        std::fs::write(&out_path, &json).unwrap();
        println!("schema written to {}", out_path.display());
    }
}
