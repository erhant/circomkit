mod convert;

use std::path::Path;

use lambdaworks_circom_adapter::{CircomR1CS, circom_to_lambda};
use lambdaworks_groth16::common::FrElement;
use lambdaworks_math::traits::ByteConversion;

use circomkit_core::types::CircuitSignals;
use circomkit_core::utils::{parse_witness_to_elems, read_r1cs_file};

use crate::error::ProveError;
use crate::traits::ProvingBackend;
use crate::types::ProofOutput;

use self::convert::{proof_to_snarkjs_json, public_inputs_to_strings};

/// Native Groth16 proving backend using Lambdaworks (BLS12-381).
///
/// This backend performs trusted setup on-the-fly for each proof, since Lambdaworks
/// does not yet support loading pre-computed `.zkey` files.
///
/// Supports both binary `.r1cs` and JSON `.r1cs.json` files.
pub struct LambdaworksBackend;

impl ProvingBackend for LambdaworksBackend {
    fn capabilities(&self) -> crate::capabilities::BackendCapabilities {
        crate::capabilities::capabilities_for(
            circomkit_core::enums::ProvingBackendKind::Lambdaworks,
        )
    }

    fn full_prove(
        &self,
        _input: &CircuitSignals,
        _wasm_path: &Path,
        _pkey_path: &Path,
    ) -> Result<ProofOutput, ProveError> {
        Err(ProveError::ProvingFailed(
            "LambdaworksBackend does not support full_prove; use circomkit-witness \
             for witness calculation, then call prove() with the witness file"
                .to_string(),
        ))
    }

    fn prove(
        &self,
        witness_path: &Path,
        r1cs_path: &Path,
        _pkey_path: &Path,
    ) -> Result<ProofOutput, ProveError> {
        // Load R1CS (binary or JSON)
        let r1cs = load_r1cs(r1cs_path)?;

        // Load witness (binary .wtns or JSON)
        let wtns = load_witness(witness_path)?;

        // Convert to Lambdaworks QAP representation
        let (qap, wtns, pubs) = circom_to_lambda(r1cs, wtns);

        // Trusted setup (on-the-fly, since zkey loading is not supported)
        log::info!("running Lambdaworks Groth16 setup (on-the-fly)");
        let (proving_key, verifying_key) = lambdaworks_groth16::setup(&qap);

        // Generate proof
        let proof = lambdaworks_groth16::Prover::prove(&wtns, &qap, &proving_key);

        // Verify internally in debug builds
        debug_assert!(
            lambdaworks_groth16::verify(&verifying_key, &proof, &pubs),
            "Lambdaworks proof verification failed internally"
        );

        let proof_json = proof_to_snarkjs_json(&proof);
        let public_signals = public_inputs_to_strings(&pubs);

        Ok(ProofOutput {
            proof: proof_json,
            public_signals,
        })
    }

    fn verify(
        &self,
        vkey: &serde_json::Value,
        public_signals: &[String],
        proof: &serde_json::Value,
    ) -> Result<bool, ProveError> {
        let _ = (vkey, public_signals, proof);
        Err(ProveError::VerificationFailed(
            "native Lambdaworks verification from snarkjs JSON not yet implemented; \
             use SnarkjsBackend for verification"
                .to_string(),
        ))
    }
}

/// Load an R1CS file, supporting both binary `.r1cs` and JSON `.r1cs.json` formats.
fn load_r1cs(path: &Path) -> Result<CircomR1CS, ProveError> {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

    if ext == "json" {
        // JSON format: use lambdaworks' own reader
        lambdaworks_circom_adapter::read_circom_r1cs(path).map_err(|e| {
            ProveError::ProvingFailed(format!(
                "failed to read R1CS JSON from {}: {e:?}",
                path.display()
            ))
        })
    } else {
        // Binary format: parse with our generic reader, convert to CircomR1CS
        let r1cs = read_r1cs_file(path, |bytes| FrElement::from_bytes_le(bytes).unwrap())?;

        Ok(CircomR1CS {
            n8: r1cs.n8,
            prime: r1cs.prime.to_string(),
            num_vars: r1cs.num_variables,
            num_outputs: r1cs.num_outputs as usize,
            num_pub_inputs: r1cs.num_pub_inputs as usize,
            num_priv_inputs: r1cs.num_priv_inputs as usize,
            num_labels: r1cs.num_labels as usize,
            num_constraints: r1cs.num_constraints,
            constraints: r1cs.constraints,
        })
    }
}

/// Load a witness file, supporting both binary `.wtns` and JSON formats.
fn load_witness(path: &Path) -> Result<Vec<FrElement>, ProveError> {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if ext == "json" {
        lambdaworks_circom_adapter::read_circom_witness(path).map_err(|e| {
            ProveError::ProvingFailed(format!(
                "failed to read witness JSON from {}: {e:?}",
                path.display()
            ))
        })
    } else {
        let data = std::fs::read(path)?;
        parse_witness_to_elems(&data, |bytes| FrElement::from_bytes_le(bytes).unwrap())
            .map_err(|e| ProveError::ProvingFailed(format!("failed to parse witness: {e}")))
    }
}
