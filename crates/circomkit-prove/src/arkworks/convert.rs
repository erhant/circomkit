use ark_bn254::{Bn254, Fq, Fq2, Fr, G1Affine, G2Affine};
use ark_ff::Zero;
use ark_groth16::{Proof, VerifyingKey};

use crate::error::ProveError;

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

/// Parse a decimal field element string (as snarkjs emits).
fn field<F: std::str::FromStr>(v: &serde_json::Value) -> Result<F, ProveError> {
    v.as_str()
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| invalid(format!("not a field element: {v}")))
}

fn invalid(msg: String) -> ProveError {
    ProveError::VerificationFailed(format!("invalid snarkjs JSON: {msg}"))
}

/// Index into a JSON array, erroring (instead of `Null`) when out of range.
fn at(v: &serde_json::Value, i: usize) -> Result<&serde_json::Value, ProveError> {
    v.get(i)
        .ok_or_else(|| invalid(format!("missing index {i} in {v}")))
}

/// Parse a snarkjs projective G1 point `[x, y, z]` (z is `1`, or `0` for infinity).
fn g1(v: &serde_json::Value) -> Result<G1Affine, ProveError> {
    if field::<Fq>(at(v, 2)?)?.is_zero() {
        return Ok(G1Affine::identity());
    }
    let p = G1Affine::new_unchecked(field(at(v, 0)?)?, field(at(v, 1)?)?);
    if !p.is_on_curve() || !p.is_in_correct_subgroup_assuming_on_curve() {
        return Err(invalid(format!("G1 point not on curve: {v}")));
    }
    Ok(p)
}

/// Parse a snarkjs projective G2 point `[[x.c0, x.c1], [y.c0, y.c1], [z.c0, z.c1]]`.
fn g2(v: &serde_json::Value) -> Result<G2Affine, ProveError> {
    let fq2 = |v: &serde_json::Value| -> Result<Fq2, ProveError> {
        Ok(Fq2::new(field(at(v, 0)?)?, field(at(v, 1)?)?))
    };
    if fq2(at(v, 2)?)?.is_zero() {
        return Ok(G2Affine::identity());
    }
    let p = G2Affine::new_unchecked(fq2(at(v, 0)?)?, fq2(at(v, 1)?)?);
    if !p.is_on_curve() || !p.is_in_correct_subgroup_assuming_on_curve() {
        return Err(invalid(format!("G2 point not on curve: {v}")));
    }
    Ok(p)
}

fn key<'a>(v: &'a serde_json::Value, k: &str) -> Result<&'a serde_json::Value, ProveError> {
    v.get(k).ok_or_else(|| invalid(format!("missing `{k}`")))
}

/// Parse a snarkjs Groth16 verification key (`verification_key.json`).
pub fn vkey_from_snarkjs_json(vkey: &serde_json::Value) -> Result<VerifyingKey<Bn254>, ProveError> {
    let ic = key(vkey, "IC")?
        .as_array()
        .ok_or_else(|| invalid("`IC` is not an array".into()))?;
    Ok(VerifyingKey {
        alpha_g1: g1(key(vkey, "vk_alpha_1")?)?,
        beta_g2: g2(key(vkey, "vk_beta_2")?)?,
        gamma_g2: g2(key(vkey, "vk_gamma_2")?)?,
        delta_g2: g2(key(vkey, "vk_delta_2")?)?,
        gamma_abc_g1: ic.iter().map(g1).collect::<Result<_, _>>()?,
    })
}

/// Parse a snarkjs Groth16 proof (`proof.json`).
pub fn proof_from_snarkjs_json(proof: &serde_json::Value) -> Result<Proof<Bn254>, ProveError> {
    Ok(Proof {
        a: g1(key(proof, "pi_a")?)?,
        b: g2(key(proof, "pi_b")?)?,
        c: g1(key(proof, "pi_c")?)?,
    })
}

/// Parse snarkjs public signals (decimal strings).
pub fn public_from_snarkjs(public_signals: &[String]) -> Result<Vec<Fr>, ProveError> {
    public_signals
        .iter()
        .map(|s| {
            s.parse()
                .map_err(|_| invalid(format!("not a field element: {s}")))
        })
        .collect()
}
