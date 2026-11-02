#![cfg(feature = "prove-arkworks")]

use std::path::PathBuf;

use circomkit_prove::{ArkworksBackend, ProofOutput, ProvingBackend};

fn test_data_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/data/multiplier_30")
}

#[test]
fn arkworks_prove_with_binary_r1cs() {
    let backend = ArkworksBackend;
    let data = test_data_dir();

    let ProofOutput {
        proof,
        public_signals,
    } = backend
        .prove(
            &data.join("witness.wtns"),
            &data.join("multiplier_30.r1cs"),
            &data.join("groth16_pkey.zkey"),
        )
        .expect("prove with binary r1cs should succeed");

    // Arkworks reports only the circuit's public output:
    // 2^30 = 1073741824.
    assert_eq!(public_signals, vec!["1073741824"]);

    assert_eq!(proof["protocol"], "groth16");
    assert_eq!(proof["curve"], "bn128");
}

#[test]
fn arkworks_full_prove_unsupported() {
    let backend = ArkworksBackend;
    let data = test_data_dir();

    let input = circomkit_core::signals! {
        "in" => vec![2_i64; 30],
    };

    // Arkworks proves from a pre-computed witness; it does not run the witness
    // calculator itself, so `full_prove` is not supported.
    let result = backend.full_prove(
        &input,
        &data.join("multiplier_30.wasm"),
        &data.join("groth16_pkey.zkey"),
    );

    assert!(result.is_err());
}

/// Prove natively, then verify natively against the snarkjs-exported vkey JSON;
/// a tampered public signal must be rejected.
#[test]
fn arkworks_verifies_snarkjs_vkey() {
    let backend = ArkworksBackend;
    let data = test_data_dir();

    let ProofOutput {
        proof,
        public_signals,
    } = backend
        .prove(
            &data.join("witness.wtns"),
            &data.join("multiplier_30.r1cs"),
            &data.join("groth16_pkey.zkey"),
        )
        .unwrap();
    let vkey: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(data.join("groth16_vkey.json")).unwrap())
            .unwrap();

    assert!(backend.verify(&vkey, &public_signals, &proof).unwrap());
    assert!(!backend.verify(&vkey, &["1".to_string()], &proof).unwrap());
    // wrong number of public signals
    assert!(!backend.verify(&vkey, &[], &proof).unwrap());
    // malformed JSON is an error, not a panic
    assert!(backend.verify(&serde_json::json!({}), &[], &proof).is_err());
}
