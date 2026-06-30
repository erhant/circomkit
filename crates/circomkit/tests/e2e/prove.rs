use circomkit::Circomkit;
use circomkit::signals;

use super::common::{TEST_PTAU, test_circomkit, workspace_root};

fn setup_multiplier(ck: &Circomkit) {
    ck.compile("multiplier_3").unwrap();
    let ptau_path = workspace_root().join("tests/ptau").join(TEST_PTAU);
    ck.setup("multiplier_3", Some(&ptau_path)).unwrap();
}

#[test]
fn full_prove_and_verify() {
    let (ck, _guard) = test_circomkit();
    setup_multiplier(&ck);

    let input = signals! { "in" => vec![2_i64, 4, 10] };
    let proof_path = ck
        .prove("multiplier_3", "prove_test", Some(&input), None)
        .unwrap();
    assert!(proof_path.exists());

    let ok = ck.verify("multiplier_3", "prove_test").unwrap();
    assert!(ok, "proof should verify");
}

#[test]
fn verify_rejects_tampered_signals() {
    let (ck, _guard) = test_circomkit();
    setup_multiplier(&ck);

    let input = signals! { "in" => vec![2_i64, 4, 10] };
    ck.prove("multiplier_3", "tamper_test", Some(&input), None)
        .unwrap();

    // Tamper with the public signals file
    let public_path = ck.paths.public_signals_path("multiplier_3", "tamper_test");
    std::fs::write(&public_path, "[\"999\"]").unwrap();

    let ok = ck.verify("multiplier_3", "tamper_test").unwrap();
    assert!(!ok, "tampered proof should not verify");
}

/// The orchestrator surfaces capability errors before doing any work: the test
/// config compiles on bn128, but lambdaworks only supports bls12381.
#[test]
fn prove_rejects_unsupported_backend_curve() {
    use circomkit::core::enums::ProvingBackendKind;

    let (mut ck, _guard) = test_circomkit();
    ck.config.prover.backend = ProvingBackendKind::Lambdaworks;

    let input = signals! { "in" => vec![2_i64, 4, 10] };
    let err = ck
        .prove("multiplier_3", "cap_test", Some(&input), None)
        .expect_err("lambdaworks on bn128 must be rejected");

    let msg = err.to_string().to_lowercase();
    assert!(
        msg.contains("lambdaworks"),
        "error should name the backend: {msg}"
    );
    assert!(
        msg.contains("curve"),
        "error should mention the curve: {msg}"
    );
}

/// The orchestrator honors `prover.backend`: switching to the native Arkworks
/// (BN254) prover produces a snarkjs-format proof that snarkjs then verifies.
#[cfg(feature = "prove-arkworks")]
#[test]
fn arkworks_backend_through_orchestrator() {
    use circomkit::core::enums::ProvingBackendKind;

    let (mut ck, _guard) = test_circomkit();
    setup_multiplier(&ck);

    // Route proving through the native Arkworks backend (BN254 / bn128).
    ck.config.prover.backend = ProvingBackendKind::Arkworks;

    let input = signals! { "in" => vec![2_i64, 4, 10] };
    let proof_path = ck
        .prove("multiplier_3", "ark_e2e", Some(&input), None)
        .unwrap();
    assert!(proof_path.exists());

    // Same proving key snarkjs set up + snarkjs-format proof => snarkjs verifies it.
    let ok = ck.verify("multiplier_3", "ark_e2e").unwrap();
    assert!(ok, "snarkjs should verify the arkworks-generated proof");
}

/// An explicit backend override (as the CLI `--backend` flag passes) wins over
/// the resolved `prover.backend`. The config defaults to snarkjs (bn128), but
/// overriding to lambdaworks (bls12381-only) surfaces the curve capability error
/// before any proving work — proving the override, not the config, was used.
#[test]
fn prove_backend_override_beats_config() {
    use circomkit::core::enums::ProvingBackendKind;

    let (ck, _guard) = test_circomkit();

    let input = signals! { "in" => vec![2_i64, 4, 10] };
    let err = ck
        .prove(
            "multiplier_3",
            "override_test",
            Some(&input),
            Some(ProvingBackendKind::Lambdaworks),
        )
        .expect_err("override to lambdaworks on bn128 must be rejected");

    let msg = err.to_string().to_lowercase();
    assert!(
        msg.contains("lambdaworks"),
        "error should name the overridden backend: {msg}"
    );
    assert!(
        msg.contains("curve"),
        "error should mention the curve: {msg}"
    );
}

#[test]
fn witness_then_prove() {
    let (ck, _guard) = test_circomkit();
    setup_multiplier(&ck);

    // Compute witness separately first
    let input = signals! { "in" => vec![3_i64, 5, 7] };
    let wtns_path = ck
        .witness("multiplier_3", "witness_test", Some(&input))
        .unwrap();
    assert!(wtns_path.exists());

    // Then prove (will recompute witness via snarkjs, but the file exists)
    let proof_path = ck
        .prove("multiplier_3", "witness_test", Some(&input), None)
        .unwrap();
    assert!(proof_path.exists());

    let ok = ck.verify("multiplier_3", "witness_test").unwrap();
    assert!(ok);
}
