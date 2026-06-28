use num_bigint::BigInt;

use crate::error::{CoreError, Result};

/// Generate calldata string from a proof and public signals.
///
/// Dispatches to the appropriate protocol-specific formatter based on the
/// `protocol` field in the proof JSON.
pub fn get_calldata(proof: &serde_json::Value, pubs: &[String], pretty: bool) -> Result<String> {
    let protocol = proof["protocol"]
        .as_str()
        .ok_or_else(|| CoreError::InvalidR1cs("proof missing 'protocol' field".to_string()))?;

    let pubs_calldata = public_signals_calldata(pubs, pretty);

    let proof_calldata = match protocol {
        "groth16" => groth16_calldata(proof, pretty),
        "plonk" => plonk_calldata(proof, pretty),
        "fflonk" => fflonk_calldata(proof, pretty),
        _ => return Err(CoreError::InvalidProtocol(protocol.to_string())),
    };

    Ok(format!("\n{proof_calldata}\n\n{pubs_calldata}\n"))
}

fn public_signals_calldata(pubs: &[String], pretty: bool) -> String {
    let pubs256 = values_to_padded_uint256s(pubs);
    if pretty {
        format!(
            "uint[{}] memory pubs = [\n    {}\n];",
            pubs.len(),
            pubs256.join(",\n    ")
        )
    } else {
        let quoted: Vec<String> = pubs256.iter().map(|s| format!("\"{s}\"")).collect();
        format!("[{}]", quoted.join(","))
    }
}

fn groth16_calldata(proof: &serde_json::Value, pretty: bool) -> String {
    let p_a = values_to_padded_uint256s(&extract_strs(&proof["pi_a"], 2));
    // Note: pB indices are reversed for Ethereum compatibility
    let p_b0 = values_to_padded_uint256s(&[
        extract_str(&proof["pi_b"][0][1]),
        extract_str(&proof["pi_b"][0][0]),
    ]);
    let p_b1 = values_to_padded_uint256s(&[
        extract_str(&proof["pi_b"][1][1]),
        extract_str(&proof["pi_b"][1][0]),
    ]);
    let p_c = values_to_padded_uint256s(&extract_strs(&proof["pi_c"], 2));

    if pretty {
        [
            format!("uint[2] memory pA = [\n  {}\n];", p_a.join(",\n  ")),
            format!(
                "uint[2][2] memory pB = [\n  [\n    {}\n  ],\n  [\n    {}\n  ]\n];",
                p_b0.join(",\n    "),
                p_b1.join(",\n    ")
            ),
            format!("uint[2] memory pC = [\n  {}\n];", p_c.join(",\n  ")),
        ]
        .join("\n")
    } else {
        [
            format!("[{}]", with_quotes(&p_a).join(", ")),
            format!(
                "[[{}], [{}]]",
                with_quotes(&p_b0).join(", "),
                with_quotes(&p_b1).join(", ")
            ),
            format!("[{}]", with_quotes(&p_c).join(", ")),
        ]
        .join("\n")
    }
}

fn plonk_calldata(proof: &serde_json::Value, pretty: bool) -> String {
    let vals = values_to_padded_uint256s(&[
        extract_str(&proof["A"][0]),
        extract_str(&proof["A"][1]),
        extract_str(&proof["B"][0]),
        extract_str(&proof["B"][1]),
        extract_str(&proof["C"][0]),
        extract_str(&proof["C"][1]),
        extract_str(&proof["Z"][0]),
        extract_str(&proof["Z"][1]),
        extract_str(&proof["T1"][0]),
        extract_str(&proof["T1"][1]),
        extract_str(&proof["T2"][0]),
        extract_str(&proof["T2"][1]),
        extract_str(&proof["T3"][0]),
        extract_str(&proof["T3"][1]),
        extract_str(&proof["Wxi"][0]),
        extract_str(&proof["Wxi"][1]),
        extract_str(&proof["Wxiw"][0]),
        extract_str(&proof["Wxiw"][1]),
        extract_str(&proof["eval_a"]),
        extract_str(&proof["eval_b"]),
        extract_str(&proof["eval_c"]),
        extract_str(&proof["eval_s1"]),
        extract_str(&proof["eval_s2"]),
        extract_str(&proof["eval_zw"]),
    ]);

    if pretty {
        format!(
            "uint[24] memory proof = [\n    {}\n];",
            vals.join(",\n    ")
        )
    } else {
        format!("[{}]", with_quotes(&vals).join(","))
    }
}

fn fflonk_calldata(proof: &serde_json::Value, pretty: bool) -> String {
    let vals = values_to_padded_uint256s(&[
        extract_str(&proof["polynomials"]["C1"][0]),
        extract_str(&proof["polynomials"]["C1"][1]),
        extract_str(&proof["polynomials"]["C2"][0]),
        extract_str(&proof["polynomials"]["C2"][1]),
        extract_str(&proof["polynomials"]["W1"][0]),
        extract_str(&proof["polynomials"]["W1"][1]),
        extract_str(&proof["polynomials"]["W2"][0]),
        extract_str(&proof["polynomials"]["W2"][1]),
        extract_str(&proof["evaluations"]["ql"]),
        extract_str(&proof["evaluations"]["qr"]),
        extract_str(&proof["evaluations"]["qm"]),
        extract_str(&proof["evaluations"]["qo"]),
        extract_str(&proof["evaluations"]["qc"]),
        extract_str(&proof["evaluations"]["s1"]),
        extract_str(&proof["evaluations"]["s2"]),
        extract_str(&proof["evaluations"]["s3"]),
        extract_str(&proof["evaluations"]["a"]),
        extract_str(&proof["evaluations"]["b"]),
        extract_str(&proof["evaluations"]["c"]),
        extract_str(&proof["evaluations"]["z"]),
        extract_str(&proof["evaluations"]["zw"]),
        extract_str(&proof["evaluations"]["t1w"]),
        extract_str(&proof["evaluations"]["t2w"]),
        extract_str(&proof["evaluations"]["inv"]),
    ]);

    if pretty {
        format!(
            "uint256[24] memory proof = [\n    {}\n];",
            vals.join(",\n    ")
        )
    } else {
        format!("[{}]", with_quotes(&vals).join(","))
    }
}

/// Convert decimal string values to 0x-prefixed, zero-padded 64-hex-char (uint256) strings.
fn values_to_padded_uint256s(values: &[String]) -> Vec<String> {
    values
        .iter()
        .map(|v| {
            let n = v
                .parse::<BigInt>()
                .unwrap_or_else(|_| panic!("invalid decimal value: {v}"));
            let hex = format!("{:064x}", n);
            assert!(hex.len() == 64, "uint256 overflow for value: {v}");
            format!("0x{hex}")
        })
        .collect()
}

fn with_quotes(vals: &[String]) -> Vec<String> {
    vals.iter().map(|v| format!("\"{v}\"")).collect()
}

fn extract_str(value: &serde_json::Value) -> String {
    value
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| value.to_string().trim_matches('"').to_string())
}

fn extract_strs(value: &serde_json::Value, count: usize) -> Vec<String> {
    (0..count).map(|i| extract_str(&value[i])).collect()
}
