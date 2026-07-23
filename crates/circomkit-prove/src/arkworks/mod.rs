mod convert;
mod core;

use std::path::Path;

use ark_bn254::Fr;
use ark_circom::CircomCircuit;

use circomkit_core::types::CircuitSignals;

use crate::error::ProveError;
use crate::traits::ProvingBackend;
use crate::types::ProofOutput;

use self::convert::proof_to_snarkjs_json;
use self::core::{load_proving_key, load_r1cs, load_witness, prove_circuit, verify};

/// Native Groth16 proving backend using Arkworks (BN254).
///
/// Supports proving with existing witnesses and proving keys.
/// Setup is not yet supported natively — use `SnarkjsBackend` for setup.
pub struct ArkworksBackend;

impl ProvingBackend for ArkworksBackend {
    fn capabilities(&self) -> crate::capabilities::BackendCapabilities {
        crate::capabilities::capabilities_for(circomkit_core::enums::ProvingBackendKind::Arkworks)
    }

    fn full_prove(
        &self,
        _input: &CircuitSignals,
        _wasm_path: &Path,
        _pkey_path: &Path,
    ) -> Result<ProofOutput, ProveError> {
        // full_prove requires witness calculation, which should be done
        // by the caller using circomkit-witness, then calling `prove()`.
        Err(ProveError::ProvingFailed(
            "ArkworksBackend does not support full_prove; use circomkit-witness \
             for witness calculation, then call prove() with the witness file"
                .to_string(),
        ))
    }

    fn prove(
        &self,
        witness_path: &Path,
        r1cs_path: &Path,
        pkey_path: &Path,
    ) -> Result<ProofOutput, ProveError> {
        let wtns: Vec<Fr> = load_witness(witness_path)?;
        let pkey = load_proving_key(pkey_path)?;

        let mut r1cs = load_r1cs(r1cs_path)?;
        // Disable wire mapping for WASM-generated witnesses.
        // See: https://github.com/arkworks-rs/circom-compat/blob/master/src/circom/builder.rs#L82
        r1cs.wire_mapping = None;

        let circom = CircomCircuit {
            r1cs,
            witness: Some(wtns),
        };

        let public_inputs = circom
            .get_public_inputs()
            .ok_or_else(|| ProveError::ProvingFailed("could not extract public inputs".into()))?;

        let proof = prove_circuit(circom, &pkey)?;

        debug_assert!(
            verify(&proof, &public_inputs, &pkey).unwrap_or(false),
            "proof verification failed internally"
        );

        let (proof_json, public_signals) = proof_to_snarkjs_json(&proof, &public_inputs);

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
        // For native verification we'd need to deserialize the snarkjs JSON back
        // into Arkworks types. For now, delegate to snarkjs for verification.
        let _ = (vkey, public_signals, proof);
        Err(ProveError::VerificationFailed(
            "native Arkworks verification from snarkjs JSON not yet implemented; \
             use SnarkjsBackend for verification"
                .to_string(),
        ))
    }
}
