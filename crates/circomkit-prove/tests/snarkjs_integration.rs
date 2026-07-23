use std::path::PathBuf;

use circomkit_core::signals;
use circomkit_prove::{ProofOutput, ProvingBackend, SnarkjsBackend};

fn test_data_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/data/multiplier_30")
}

#[test]
fn snarkjs_full_prove_and_verify() {
    let backend = SnarkjsBackend::default();
    let data = test_data_dir();

    let input = signals! {
        "in" => vec![2_i64; 30],
    };

    let ProofOutput {
        proof,
        public_signals,
    } = backend
        .full_prove(
            &input,
            &data.join("multiplier_30.wasm"),
            &data.join("groth16_pkey.zkey"),
        )
        .expect("full_prove should succeed");

    // Output should be 2^30 = 1073741824
    assert_eq!(public_signals, vec!["1073741824"]);

    // Proof should have the groth16 structure
    assert_eq!(proof["protocol"], "groth16");

    // Verify with the vkey
    let vkey: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(data.join("groth16_vkey.json")).unwrap())
            .unwrap();

    let ok = backend
        .verify(&vkey, &public_signals, &proof)
        .expect("verify should not error");
    assert!(ok, "proof should verify");
}

#[test]
fn snarkjs_verify_rejects_bad_proof() {
    let backend = SnarkjsBackend::default();
    let data = test_data_dir();

    let input = signals! {
        "in" => vec![2_i64; 30],
    };

    let ProofOutput {
        proof,
        mut public_signals,
    } = backend
        .full_prove(
            &input,
            &data.join("multiplier_30.wasm"),
            &data.join("groth16_pkey.zkey"),
        )
        .unwrap();

    // Tamper with public signals
    public_signals[0] = "999".to_string();

    let vkey: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(data.join("groth16_vkey.json")).unwrap())
            .unwrap();

    let ok = backend.verify(&vkey, &public_signals, &proof).unwrap();
    assert!(!ok, "tampered proof should not verify");
}
