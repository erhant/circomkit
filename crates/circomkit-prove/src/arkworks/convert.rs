use ark_bn254::{Bn254, Fr};
use ark_groth16::Proof;

/// Convert an Arkworks Groth16 proof + public inputs to snarkjs-compatible JSON.
pub fn proof_to_snarkjs_json(
    proof: &Proof<Bn254>,
    public_inputs: &[Fr],
) -> (serde_json::Value, Vec<String>) {
    let proof_json = serde_json::json!({
        "pi_a": [proof.a.x.to_string(), proof.a.y.to_string(), "1"],
        "pi_b": [
            [proof.b.x.c0.to_string(), proof.b.x.c1.to_string()],
            [proof.b.y.c0.to_string(), proof.b.y.c1.to_string()],
            ["1", "0"]
        ],
        "pi_c": [proof.c.x.to_string(), proof.c.y.to_string(), "1"],
        "protocol": "groth16",
        "curve": "bn128"
    });

    let public_signals: Vec<String> = public_inputs.iter().map(|s| s.to_string()).collect();

    (proof_json, public_signals)
}
