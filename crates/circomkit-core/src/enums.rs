use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Zero-knowledge proof protocol.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    Groth16,
    Plonk,
    Fflonk,
}

impl fmt::Display for Protocol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Groth16 => write!(f, "groth16"),
            Self::Plonk => write!(f, "plonk"),
            Self::Fflonk => write!(f, "fflonk"),
        }
    }
}

/// Finite field / elliptic curve prime.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum Prime {
    Bn128,
    Bls12381,
    Goldilocks,
    Grumpkin,
    Pallas,
    Vesta,
    Secq256r1,
}

impl fmt::Display for Prime {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Bn128 => write!(f, "bn128"),
            Self::Bls12381 => write!(f, "bls12381"),
            Self::Goldilocks => write!(f, "goldilocks"),
            Self::Grumpkin => write!(f, "grumpkin"),
            Self::Pallas => write!(f, "pallas"),
            Self::Vesta => write!(f, "vesta"),
            Self::Secq256r1 => write!(f, "secq256r1"),
        }
    }
}

/// Binary artifact that can be exported to JSON (via snarkjs).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum JsonTarget {
    /// Compiled constraint system (`.r1cs`).
    R1cs,
    /// Proving key (`.zkey`, Groth16 only).
    Zkey,
    /// Witness (`.wtns`) for a given input.
    Wtns,
}

impl fmt::Display for JsonTarget {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::R1cs => write!(f, "r1cs"),
            Self::Zkey => write!(f, "zkey"),
            Self::Wtns => write!(f, "wtns"),
        }
    }
}

/// Witness calculator backend.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum WitnessBackend {
    #[default]
    Wasm,
    C,
}

/// Proving backend kind.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum ProvingBackendKind {
    #[default]
    Snarkjs,
    Arkworks,
}

impl fmt::Display for ProvingBackendKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Snarkjs => write!(f, "snarkjs"),
            Self::Arkworks => write!(f, "arkworks"),
        }
    }
}

impl std::str::FromStr for ProvingBackendKind {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "snarkjs" => Ok(Self::Snarkjs),
            "arkworks" => Ok(Self::Arkworks),
            other => Err(format!(
                "unknown proving backend '{other}' (expected: snarkjs, arkworks)"
            )),
        }
    }
}

/// Log level for circomkit operations.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Trace,
    Debug,
    #[default]
    Info,
    Warn,
    Error,
    Silent,
}

impl LogLevel {
    /// Convert to `log::LevelFilter`.
    pub fn to_level_filter(self) -> log::LevelFilter {
        match self {
            Self::Trace => log::LevelFilter::Trace,
            Self::Debug => log::LevelFilter::Debug,
            Self::Info => log::LevelFilter::Info,
            Self::Warn => log::LevelFilter::Warn,
            Self::Error => log::LevelFilter::Error,
            Self::Silent => log::LevelFilter::Off,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn proving_backend_kind_from_str_roundtrips() {
        for kind in [ProvingBackendKind::Snarkjs, ProvingBackendKind::Arkworks] {
            let parsed: ProvingBackendKind = kind.to_string().parse().unwrap();
            assert_eq!(parsed, kind);
        }
        // Case-insensitive parsing.
        assert_eq!(
            "ARKWORKS".parse::<ProvingBackendKind>().unwrap(),
            ProvingBackendKind::Arkworks
        );
    }

    #[test]
    fn proving_backend_kind_from_str_rejects_unknown() {
        let err = "plonky2".parse::<ProvingBackendKind>().unwrap_err();
        assert!(
            err.contains("plonky2"),
            "error should name the bad input: {err}"
        );
    }
}
