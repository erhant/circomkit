#![cfg(feature = "prove-lambdaworks")]

use std::path::PathBuf;

use circomkit_prove::{LambdaworksBackend, ProofOutput, ProvingBackend};

fn test_data_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/data/multiplier_30")
}

#[test]
fn lambdaworks_prove_with_binary_r1cs() {
    let backend = LambdaworksBackend;
    let data = test_data_dir();

    let ProofOutput {
        proof,
        public_signals,
    } = backend
        .prove(
            &data.join("witness.wtns"),
            &data.join("multiplier_30.r1cs"),
            &data.join("unused.zkey"), // pkey_path is unused by Lambdaworks
        )
        .expect("prove with binary r1cs should succeed");

    // Lambdaworks includes the constant wire "1" as the first public signal,
    // followed by the actual output: 2^30 = 1073741824
    assert_eq!(public_signals, vec!["1", "1073741824"]);

    assert_eq!(proof["protocol"], "groth16");
    assert_eq!(proof["curve"], "bls12381");
}

#[test]
fn lambdaworks_prove_with_json_r1cs() {
    let backend = LambdaworksBackend;
    let data = test_data_dir();

    let ProofOutput {
        proof,
        public_signals,
    } = backend
        .prove(
            &data.join("witness.wtns"),
            &data.join("multiplier_30.r1cs.json"),
            &data.join("unused.zkey"),
        )
        .expect("prove with json r1cs should succeed");

    assert_eq!(public_signals, vec!["1", "1073741824"]);

    assert_eq!(proof["protocol"], "groth16");
    assert_eq!(proof["curve"], "bls12381");
}

#[test]
fn lambdaworks_full_prove_unsupported() {
    let backend = LambdaworksBackend;
    let data = test_data_dir();

    let input = circomkit_core::signals! {
        "in" => vec![2_i64; 30],
    };

    let result = backend.full_prove(
        &input,
        &data.join("multiplier_30.wasm"),
        &data.join("unused.zkey"),
    );

    assert!(result.is_err());
}
