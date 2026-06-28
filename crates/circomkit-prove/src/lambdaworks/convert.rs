use lambdaworks_groth16::Proof;
use lambdaworks_math::field::{element::FieldElement, traits::IsPrimeField};
use num_bigint::BigUint;

/// Convert a Lambdaworks `UnsignedInteger` hex representation to a decimal string.
///
/// `representative().to_string()` returns `0x...` hex; snarkjs expects decimal.
fn to_decimal(hex_str: &str) -> String {
    let hex = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    if hex.is_empty() || hex.chars().all(|c| c == '0') {
        return "0".to_string();
    }
    BigUint::parse_bytes(hex.as_bytes(), 16)
        .expect("invalid hex from representative()")
        .to_string()
}

/// Convert a field element's representative to a decimal string.
fn field_to_dec<F: IsPrimeField>(elem: &FieldElement<F>) -> String {
    to_decimal(&elem.representative().to_string())
}

/// Convert a Lambdaworks Groth16 proof to snarkjs-compatible JSON.
pub fn proof_to_snarkjs_json(proof: &Proof) -> serde_json::Value {
    serde_json::json!({
        "pi_a": [
            field_to_dec(&proof.pi1.x()),
            field_to_dec(&proof.pi1.y()),
            "1"
        ],
        "pi_b": [
            [
                field_to_dec(&proof.pi2.x().value()[0]),
                field_to_dec(&proof.pi2.x().value()[1]),
            ],
            [
                field_to_dec(&proof.pi2.y().value()[0]),
                field_to_dec(&proof.pi2.y().value()[1]),
            ],
            ["1", "0"]
        ],
        "pi_c": [
            field_to_dec(&proof.pi3.x()),
            field_to_dec(&proof.pi3.y()),
            "1"
        ],
        "protocol": "groth16",
        "curve": "bls12381"
    })
}

/// Convert Lambdaworks field elements to decimal public signal strings.
pub fn public_inputs_to_strings<F: IsPrimeField>(public_inputs: &[FieldElement<F>]) -> Vec<String> {
    public_inputs.iter().map(|s| field_to_dec(s)).collect()
}
