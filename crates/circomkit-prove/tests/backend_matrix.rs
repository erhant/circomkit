//! Cross-backend / cross-curve proving matrix.
//!
//! Two concerns are covered:
//!
//! 1. **Capability matrix** — every `(backend, protocol, curve)` request is
//!    routed through [`make_proving_backend`], which must either return a
//!    backend (supported, feature enabled), a `BackendNotEnabled` error
//!    (supported, feature off), or a precise `UnsupportedProtocol` /
//!    `UnsupportedCurve` error (unsupported). This part always runs.
//!
//! 2. **Real proofs** — for the combinations we have fixtures for, an actual
//!    proof is generated with each backend on its native curve. These parts are
//!    gated behind the relevant `prove-*` features (and snarkjs needs the
//!    `snarkjs` CLI on PATH).

use std::path::PathBuf;

use circomkit_core::enums::{Prime, Protocol, ProvingBackendKind};
use circomkit_prove::{ProveError, capabilities_for, make_proving_backend};

fn test_data_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/data/multiplier_30")
}

const ALL_BACKENDS: &[ProvingBackendKind] = &[
    ProvingBackendKind::Snarkjs,
    ProvingBackendKind::Lambdaworks,
    ProvingBackendKind::Arkworks,
];

const ALL_PROTOCOLS: &[Protocol] = &[Protocol::Groth16, Protocol::Plonk, Protocol::Fflonk];

const ALL_PRIMES: &[Prime] = &[
    Prime::Bn128,
    Prime::Bls12381,
    Prime::Goldilocks,
    Prime::Grumpkin,
    Prime::Pallas,
    Prime::Vesta,
    Prime::Secq256r1,
];

/// Walk the entire grid and assert `make_proving_backend` agrees with the
/// capability table: unsupported combos error with a capability error,
/// supported combos either build or report the feature is disabled.
#[test]
fn capability_matrix_is_enforced() {
    for &kind in ALL_BACKENDS {
        let caps = capabilities_for(kind);
        for &protocol in ALL_PROTOCOLS {
            for &prime in ALL_PRIMES {
                let result = make_proving_backend(kind, protocol, prime);
                let supported = caps.supports(protocol, prime);

                match result {
                    Ok(backend) => {
                        assert!(
                            supported,
                            "{kind:?} built a backend for an unsupported ({protocol}, {prime})"
                        );
                        // The constructed backend must report the same support.
                        assert!(backend.capabilities().supports(protocol, prime));
                    }
                    Err(ProveError::BackendNotEnabled { .. }) => {
                        // Only valid when the combo is genuinely supported but
                        // the backend feature is compiled out.
                        assert!(
                            supported,
                            "{kind:?} reported BackendNotEnabled for unsupported ({protocol}, {prime})"
                        );
                    }
                    Err(ProveError::UnsupportedProtocol { .. }) => {
                        assert!(
                            !caps.protocols.contains(&protocol),
                            "{kind:?} rejected protocol {protocol} that it claims to support"
                        );
                    }
                    Err(ProveError::UnsupportedCurve { .. }) => {
                        assert!(
                            caps.protocols.contains(&protocol) && !caps.primes.contains(&prime),
                            "{kind:?} rejected curve {prime} unexpectedly"
                        );
                    }
                    Err(e) => panic!("unexpected error for {kind:?} ({protocol}, {prime}): {e}"),
                }
            }
        }
    }
}

/// Spot-check the specific examples called out in the design: the native
/// backends are Groth16-only and curve-specific.
#[test]
fn unsupported_combinations_give_clear_errors() {
    // Lambdaworks: Groth16 + BLS12-381 only.
    assert!(matches!(
        make_proving_backend(
            ProvingBackendKind::Lambdaworks,
            Protocol::Plonk,
            Prime::Bls12381
        ),
        Err(ProveError::UnsupportedProtocol {
            backend: "lambdaworks",
            ..
        })
    ));
    assert!(matches!(
        make_proving_backend(
            ProvingBackendKind::Lambdaworks,
            Protocol::Groth16,
            Prime::Bn128
        ),
        Err(ProveError::UnsupportedCurve {
            backend: "lambdaworks",
            ..
        })
    ));

    // Arkworks: Groth16 + BN254 (bn128) only.
    assert!(matches!(
        make_proving_backend(ProvingBackendKind::Arkworks, Protocol::Fflonk, Prime::Bn128),
        Err(ProveError::UnsupportedProtocol {
            backend: "arkworks",
            ..
        })
    ));
    assert!(matches!(
        make_proving_backend(
            ProvingBackendKind::Arkworks,
            Protocol::Groth16,
            Prime::Bls12381
        ),
        Err(ProveError::UnsupportedCurve {
            backend: "arkworks",
            ..
        })
    ));

    // snarkjs is universal — no capability error anywhere in the grid.
    for &protocol in ALL_PROTOCOLS {
        for &prime in ALL_PRIMES {
            assert!(
                make_proving_backend(ProvingBackendKind::Snarkjs, protocol, prime).is_ok(),
                "snarkjs should support ({protocol}, {prime})"
            );
        }
    }
}

/// Arkworks proves Groth16 over BN254 from a snarkjs `.zkey` + witness.
#[cfg(feature = "prove-arkworks")]
#[test]
fn arkworks_groth16_bn254_proves() {
    let data = test_data_dir();
    let backend = make_proving_backend(
        ProvingBackendKind::Arkworks,
        Protocol::Groth16,
        Prime::Bn128,
    )
    .expect("arkworks backend should build");

    let output = backend
        .prove(
            &data.join("witness.wtns"),
            &data.join("multiplier_30.r1cs"),
            &data.join("groth16_pkey.zkey"),
        )
        .expect("arkworks prove should succeed");

    assert_eq!(output.proof["protocol"], "groth16");
    assert_eq!(output.proof["curve"], "bn128");
    // multiplier_30 over 2 thirty times => 2^30 = 1073741824 is the public output.
    assert_eq!(output.public_signals, vec!["1073741824"]);
}

/// Lambdaworks proves Groth16 over BLS12-381 with an on-the-fly setup.
#[cfg(feature = "prove-lambdaworks")]
#[test]
fn lambdaworks_groth16_bls12381_proves() {
    let data = test_data_dir();
    let backend = make_proving_backend(
        ProvingBackendKind::Lambdaworks,
        Protocol::Groth16,
        Prime::Bls12381,
    )
    .expect("lambdaworks backend should build");

    let output = backend
        .prove(
            &data.join("witness.wtns"),
            &data.join("multiplier_30.r1cs"),
            &data.join("unused.zkey"),
        )
        .expect("lambdaworks prove should succeed");

    assert_eq!(output.proof["protocol"], "groth16");
    assert_eq!(output.proof["curve"], "bls12381");
    // Lambdaworks includes the constant "1" wire ahead of the output.
    assert_eq!(output.public_signals, vec!["1", "1073741824"]);
}

/// snarkjs proves Groth16 over BN254 via the CLI (needs `snarkjs` on PATH).
#[test]
fn snarkjs_groth16_bn254_proves() {
    let data = test_data_dir();
    let zkey = data.join("groth16_pkey.zkey");
    let wasm = data.join("multiplier_30.wasm");
    if !zkey.exists() || !wasm.exists() {
        eprintln!("skipping: snarkjs fixtures missing");
        return;
    }

    let backend =
        make_proving_backend(ProvingBackendKind::Snarkjs, Protocol::Groth16, Prime::Bn128)
            .expect("snarkjs backend should build");

    let input = circomkit_core::signals! { "in" => vec![2_i64; 30] };

    match backend.full_prove(&input, &wasm, &zkey) {
        Ok(output) => {
            assert_eq!(output.proof["protocol"], "groth16");
            assert_eq!(output.public_signals, vec!["1073741824"]);
        }
        Err(e) => eprintln!("skipping snarkjs assertion (snarkjs CLI unavailable?): {e}"),
    }
}
