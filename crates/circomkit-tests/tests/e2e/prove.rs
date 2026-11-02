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
/// config is switched to bls12381, but arkworks only supports bn128.
#[test]
fn prove_rejects_unsupported_backend_curve() {
    use circomkit::core::enums::{Prime, ProvingBackendKind};

    let (mut ck, _guard) = test_circomkit();
    ck.config.compiler.prime = Prime::Bls12381;
    ck.config.prover.backend = ProvingBackendKind::Arkworks;

    let input = signals! { "in" => vec![2_i64, 4, 10] };
    let err = ck
        .prove("multiplier_3", "cap_test", Some(&input), None)
        .expect_err("arkworks on bls12381 must be rejected");

    let msg = err.to_string().to_lowercase();
    assert!(
        msg.contains("arkworks"),
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

    // Native arkworks verification against the snarkjs-exported vkey.
    assert!(ck.verify("multiplier_3", "ark_e2e").unwrap());

    // Same proving key snarkjs set up + snarkjs-format proof => snarkjs verifies it too.
    ck.config.prover.backend = ProvingBackendKind::Snarkjs;
    assert!(
        ck.verify("multiplier_3", "ark_e2e").unwrap(),
        "snarkjs should verify the arkworks-generated proof"
    );
}

/// An explicit backend override (as the CLI `--backend` flag passes) wins over
/// the resolved `prover.backend`. The config uses snarkjs (valid on bls12381),
/// but overriding to arkworks (bn128-only) surfaces the curve capability error
/// before any proving work — proving the override, not the config, was used.
#[test]
fn prove_backend_override_beats_config() {
    use circomkit::core::enums::{Prime, ProvingBackendKind};

    let (mut ck, _guard) = test_circomkit();
    ck.config.compiler.prime = Prime::Bls12381;

    let input = signals! { "in" => vec![2_i64, 4, 10] };
    let err = ck
        .prove(
            "multiplier_3",
            "override_test",
            Some(&input),
            Some(ProvingBackendKind::Arkworks),
        )
        .expect_err("override to arkworks on bls12381 must be rejected");

    let msg = err.to_string().to_lowercase();
    assert!(
        msg.contains("arkworks"),
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

#[test]
fn json_exports() {
    use circomkit::JsonTarget;

    let (ck, _guard) = test_circomkit();
    setup_multiplier(&ck);
    let input = signals! { "in" => vec![2_i64, 4, 10] };
    ck.witness("multiplier_3", "json_test", Some(&input))
        .unwrap();

    for (target, input) in [
        (JsonTarget::R1cs, None),
        (JsonTarget::Zkey, None),
        (JsonTarget::Wtns, Some("json_test")),
    ] {
        let path = ck.json(target, "multiplier_3", input).unwrap();
        let json: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert!(!json.is_null(), "{target} export should be JSON");
    }

    // wtns needs an input name
    assert!(ck.json(JsonTarget::Wtns, "multiplier_3", None).is_err());
}

/// A per-circuit `protocol` override must reach every snarkjs step: with a
/// global groth16 config, a plonk-overridden circuit gets a real PLONK key
/// (not a groth16 key saved under the plonk path), and vkey/calldata follow.
#[test]
fn per_circuit_protocol_override() {
    use circomkit::core::config::{CircuitOverrides, PartialCompilerConfig, PartialProverConfig};
    use circomkit::core::enums::Protocol;

    let (mut ck, _guard) = test_circomkit();
    assert_eq!(ck.config.prover.protocol, Protocol::Groth16);
    ck.config
        .circuits
        .get_mut("multiplier_3")
        .unwrap()
        .overrides = Some(CircuitOverrides {
        prover: Some(PartialProverConfig {
            protocol: Some(Protocol::Plonk),
            ..Default::default()
        }),
        // PLONK requires O1; the test config's global level is O0.
        compiler: Some(PartialCompilerConfig {
            optimization: Some(1),
            ..Default::default()
        }),
        ..Default::default()
    });
    setup_multiplier(&ck);

    let vkey_path = ck.vkey("multiplier_3").unwrap();
    assert_eq!(vkey_path, ck.paths.vkey("multiplier_3", Protocol::Plonk));
    let vkey: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&vkey_path).unwrap()).unwrap();
    assert_eq!(vkey["protocol"], "plonk");

    let input = signals! { "in" => vec![2_i64, 4, 10] };
    ck.prove("multiplier_3", "plonk_override", Some(&input), None)
        .unwrap();
    assert!(ck.verify("multiplier_3", "plonk_override").unwrap());
    ck.calldata("multiplier_3", "plonk_override", false)
        .unwrap();
}

/// Auto-PTAU only knows the BN254 Hermez ceremony; other curves must error
/// instead of silently fetching a wrong-curve file.
#[test]
fn ptau_rejects_non_bn128() {
    use circomkit::core::enums::Prime;

    let (mut ck, _guard) = test_circomkit();
    ck.config.compiler.prime = Prime::Bls12381;
    let err = ck
        .ptau("multiplier_3")
        .expect_err("bls12381 has no auto PTAU");
    assert!(err.to_string().contains("bls12381"), "{err}");
}
