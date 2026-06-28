use std::path::Path;

use circomkit_core::config::ProverConfig;
use circomkit_core::enums::Protocol;
use circomkit_core::types::CircuitSignals;

use crate::capabilities::BackendCapabilities;
use crate::error::ProveError;
use crate::types::ProofOutput;

/// Trait for proving backends.
pub trait ProvingBackend {
    /// Describe which protocols and curves this backend supports.
    fn capabilities(&self) -> BackendCapabilities;

    /// Generate a proof from circuit inputs (full pipeline: witness + prove).
    fn full_prove(
        &self,
        input: &CircuitSignals,
        wasm_path: &Path,
        pkey_path: &Path,
    ) -> Result<ProofOutput, ProveError>;

    /// Generate a proof from a pre-computed witness file.
    fn prove(
        &self,
        witness_path: &Path,
        r1cs_path: &Path,
        pkey_path: &Path,
    ) -> Result<ProofOutput, ProveError>;

    /// Verify a proof against public signals and a verification key.
    fn verify(
        &self,
        vkey: &serde_json::Value,
        public_signals: &[String],
        proof: &serde_json::Value,
    ) -> Result<bool, ProveError>;
}

/// Trait for trusted setup operations.
pub trait SetupBackend {
    /// Run trusted setup (phase-2 ceremony for Groth16, or direct setup for PLONK/FFLONK).
    fn setup(
        &self,
        r1cs_path: &Path,
        ptau_path: &Path,
        pkey_path: &Path,
        config: &ProverConfig,
    ) -> Result<(), ProveError>;

    /// Export a verification key from a proving key.
    fn export_vkey(&self, pkey_path: &Path, vkey_path: &Path) -> Result<(), ProveError>;

    /// Export a Solidity verifier contract from a proving key.
    fn export_contract(
        &self,
        pkey_path: &Path,
        sol_path: &Path,
        protocol: Protocol,
    ) -> Result<(), ProveError>;
}
