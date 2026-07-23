//! Backend capability matrix.
//!
//! Each proving backend supports a different slice of the (protocol, curve)
//! space. snarkjs is the universal backend (all protocols, all primes), while
//! the native backends are specialized:
//!
//! | backend     | protocols                | curves           | setup        | native verify |
//! |-------------|--------------------------|------------------|--------------|---------------|
//! | snarkjs     | groth16, plonk, fflonk   | all 7 primes     | yes          | yes           |
//! | lambdaworks | groth16                  | bls12381         | on-the-fly   | no            |
//! | arkworks    | groth16                  | bn128 (BN254)    | no (zkey)    | no            |
//!
//! These tables are the single source of truth used both to pick a backend
//! ([`crate::make_proving_backend`]) and to produce clear errors for
//! unsupported combinations.

use circomkit_core::enums::{Prime, Protocol, ProvingBackendKind};

use crate::error::ProveError;

/// Describes which proving features a backend supports.
#[derive(Debug, Clone)]
pub struct BackendCapabilities {
    /// Human-readable backend name (matches [`ProvingBackendKind`]).
    pub name: &'static str,
    /// Protocols this backend can prove.
    pub protocols: &'static [Protocol],
    /// Primes (curves) this backend supports.
    pub primes: &'static [Prime],
    /// Whether the backend can run its own trusted setup.
    pub supports_setup: bool,
    /// Whether the backend can verify a snarkjs-format proof natively.
    pub supports_native_verify: bool,
    /// Whether the backend consumes a `.zkey` proving key
    /// (`false` means it performs an on-the-fly setup instead).
    pub uses_zkey: bool,
}

impl BackendCapabilities {
    /// Returns `true` if the backend supports the given protocol and curve.
    pub fn supports(&self, protocol: Protocol, prime: Prime) -> bool {
        self.protocols.contains(&protocol) && self.primes.contains(&prime)
    }

    /// Returns an error describing exactly why a (protocol, curve) combination
    /// is not supported, or `Ok(())` if it is.
    pub fn ensure_supports(&self, protocol: Protocol, prime: Prime) -> Result<(), ProveError> {
        if !self.protocols.contains(&protocol) {
            return Err(ProveError::UnsupportedProtocol {
                backend: self.name,
                protocol,
                supported: join_display(self.protocols),
            });
        }
        if !self.primes.contains(&prime) {
            return Err(ProveError::UnsupportedCurve {
                backend: self.name,
                prime,
                supported: join_display(self.primes),
            });
        }
        Ok(())
    }
}

/// All primes snarkjs can prove over.
const ALL_PRIMES: &[Prime] = &[
    Prime::Bn128,
    Prime::Bls12381,
    Prime::Goldilocks,
    Prime::Grumpkin,
    Prime::Pallas,
    Prime::Vesta,
    Prime::Secq256r1,
];

/// Static capability table for a backend kind.
///
/// This is available without constructing the backend, so a capability check
/// can run even when the corresponding backend feature is compiled out.
pub fn capabilities_for(kind: ProvingBackendKind) -> BackendCapabilities {
    match kind {
        ProvingBackendKind::Snarkjs => BackendCapabilities {
            name: "snarkjs",
            protocols: &[Protocol::Groth16, Protocol::Plonk, Protocol::Fflonk],
            primes: ALL_PRIMES,
            supports_setup: true,
            supports_native_verify: true,
            uses_zkey: true,
        },
        ProvingBackendKind::Lambdaworks => BackendCapabilities {
            name: "lambdaworks",
            protocols: &[Protocol::Groth16],
            primes: &[Prime::Bls12381],
            supports_setup: true,
            supports_native_verify: false,
            uses_zkey: false,
        },
        ProvingBackendKind::Arkworks => BackendCapabilities {
            name: "arkworks",
            protocols: &[Protocol::Groth16],
            primes: &[Prime::Bn128],
            supports_setup: false,
            supports_native_verify: false,
            uses_zkey: true,
        },
    }
}

fn join_display<T: std::fmt::Display>(items: &[T]) -> String {
    items
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<_>>()
        .join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snarkjs_supports_everything() {
        let caps = capabilities_for(ProvingBackendKind::Snarkjs);
        assert!(caps.supports(Protocol::Groth16, Prime::Bn128));
        assert!(caps.supports(Protocol::Plonk, Prime::Bls12381));
        assert!(caps.supports(Protocol::Fflonk, Prime::Vesta));
        assert!(
            caps.ensure_supports(Protocol::Plonk, Prime::Goldilocks)
                .is_ok()
        );
    }

    #[test]
    fn lambdaworks_is_groth16_bls12381_only() {
        let caps = capabilities_for(ProvingBackendKind::Lambdaworks);
        assert!(caps.supports(Protocol::Groth16, Prime::Bls12381));
        // wrong protocol
        assert!(matches!(
            caps.ensure_supports(Protocol::Plonk, Prime::Bls12381),
            Err(ProveError::UnsupportedProtocol { .. })
        ));
        // wrong curve
        assert!(matches!(
            caps.ensure_supports(Protocol::Groth16, Prime::Bn128),
            Err(ProveError::UnsupportedCurve { .. })
        ));
    }

    #[test]
    fn arkworks_is_groth16_bn128_only() {
        let caps = capabilities_for(ProvingBackendKind::Arkworks);
        assert!(caps.supports(Protocol::Groth16, Prime::Bn128));
        assert!(matches!(
            caps.ensure_supports(Protocol::Groth16, Prime::Bls12381),
            Err(ProveError::UnsupportedCurve { .. })
        ));
        assert!(matches!(
            caps.ensure_supports(Protocol::Fflonk, Prime::Bn128),
            Err(ProveError::UnsupportedProtocol { .. })
        ));
    }
}
