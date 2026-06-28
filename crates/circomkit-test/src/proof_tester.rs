use std::path::PathBuf;

use circomkit_core::enums::Protocol;
use circomkit_core::types::CircuitSignals;
use circomkit_prove::ProofOutput;
use circomkit_prove::ProvingBackend;

use crate::error::TestError;

/// A circuit tester focused on proof-level testing.
pub struct ProofTester {
    backend: Box<dyn ProvingBackend>,
    wasm_path: PathBuf,
    pkey_path: PathBuf,
    /// The parsed verification key.
    pub vkey: serde_json::Value,
    /// The protocol used for proofs.
    pub protocol: Protocol,
}

impl ProofTester {
    pub fn new(
        backend: Box<dyn ProvingBackend>,
        wasm_path: PathBuf,
        pkey_path: PathBuf,
        vkey_path: PathBuf,
        protocol: Protocol,
    ) -> Result<Self, TestError> {
        let vkey_str = std::fs::read_to_string(&vkey_path)?;
        let vkey: serde_json::Value = serde_json::from_str(&vkey_str)?;

        Ok(Self {
            backend,
            wasm_path,
            pkey_path,
            vkey,
            protocol,
        })
    }

    /// Generate a proof from circuit inputs.
    pub fn prove(&self, input: &CircuitSignals) -> Result<ProofOutput, TestError> {
        Ok(self
            .backend
            .full_prove(input, &self.wasm_path, &self.pkey_path)?)
    }

    /// Verify a proof.
    pub fn verify(
        &self,
        proof: &serde_json::Value,
        public_signals: &[String],
    ) -> Result<bool, TestError> {
        Ok(self.backend.verify(&self.vkey, public_signals, proof)?)
    }

    /// Assert that verification passes.
    pub fn expect_pass(
        &self,
        proof: &serde_json::Value,
        public_signals: &[String],
    ) -> Result<(), TestError> {
        if !self.verify(proof, public_signals)? {
            return Err(TestError::VerificationExpectedPass);
        }
        Ok(())
    }

    /// Assert that verification fails.
    pub fn expect_fail(
        &self,
        proof: &serde_json::Value,
        public_signals: &[String],
    ) -> Result<(), TestError> {
        if self.verify(proof, public_signals)? {
            return Err(TestError::VerificationExpectedFail);
        }
        Ok(())
    }
}
