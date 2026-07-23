mod capabilities;
mod error;
mod snarkjs;
mod traits;
mod types;

#[cfg(feature = "prove-arkworks")]
mod arkworks;

#[cfg(feature = "prove-lambdaworks")]
mod lambdaworks;

pub use capabilities::{BackendCapabilities, capabilities_for};
pub use error::ProveError;
pub use snarkjs::SnarkjsBackend;
pub use traits::{ProvingBackend, SetupBackend};
pub use types::ProofOutput;

#[cfg(feature = "prove-arkworks")]
pub use arkworks::ArkworksBackend;

#[cfg(feature = "prove-lambdaworks")]
pub use lambdaworks::LambdaworksBackend;

use circomkit_core::enums::{Prime, Protocol, ProvingBackendKind};

/// Construct a proving backend for a `(backend, protocol, curve)` request.
///
/// The capability matrix is checked first, so an unsupported protocol/curve
/// combination produces a precise [`ProveError::UnsupportedProtocol`] /
/// [`ProveError::UnsupportedCurve`] regardless of which backend features are
/// compiled in. If the combination is valid but the backend's feature is not
/// enabled, [`ProveError::BackendNotEnabled`] is returned instead.
pub fn make_proving_backend(
    kind: ProvingBackendKind,
    protocol: Protocol,
    prime: Prime,
) -> Result<Box<dyn ProvingBackend>, ProveError> {
    // Capability check is always available, even for compiled-out backends.
    capabilities_for(kind).ensure_supports(protocol, prime)?;

    match kind {
        ProvingBackendKind::Snarkjs => Ok(Box::new(SnarkjsBackend::new("snarkjs", protocol))),

        ProvingBackendKind::Lambdaworks => {
            #[cfg(feature = "prove-lambdaworks")]
            {
                Ok(Box::new(LambdaworksBackend))
            }
            #[cfg(not(feature = "prove-lambdaworks"))]
            {
                Err(ProveError::BackendNotEnabled {
                    backend: "lambdaworks",
                    feature: "prove-lambdaworks",
                })
            }
        }

        ProvingBackendKind::Arkworks => {
            #[cfg(feature = "prove-arkworks")]
            {
                Ok(Box::new(ArkworksBackend))
            }
            #[cfg(not(feature = "prove-arkworks"))]
            {
                Err(ProveError::BackendNotEnabled {
                    backend: "arkworks",
                    feature: "prove-arkworks",
                })
            }
        }
    }
}
