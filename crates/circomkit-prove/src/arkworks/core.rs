use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use ark_bn254::{Bn254, Fr};
use ark_circom::circom::{R1CS, R1CSFile};
use ark_circom::{CircomCircuit, CircomReduction, read_zkey};
use ark_ff::PrimeField;
use ark_groth16::{Groth16, Proof, ProvingKey};
use ark_relations::gr1cs::SynthesisError;
use ark_serialize::SerializationError;
use rand::thread_rng;

use crate::error::ProveError;

/// Load R1CS from a binary `.r1cs` file.
pub fn load_r1cs<F: PrimeField>(r1cs_path: &Path) -> Result<R1CS<F>, ProveError> {
    let reader = BufReader::new(File::open(r1cs_path)?);
    R1CSFile::new(reader)
        .map(Into::into)
        .map_err(|e: SerializationError| {
            ProveError::ProvingFailed(format!("failed to load R1CS: {e}"))
        })
}

/// Load a proving key from a `.zkey` file.
pub fn load_proving_key(pkey_path: &Path) -> Result<ProvingKey<Bn254>, ProveError> {
    let mut reader = BufReader::new(File::open(pkey_path)?);
    let (params, _) = read_zkey(&mut reader)
        .map_err(|e| ProveError::ProvingFailed(format!("failed to load zkey: {e}")))?;
    Ok(params)
}

/// Load a witness from a binary `.wtns` file.
pub fn load_witness<F: PrimeField>(wtns_path: &Path) -> Result<Vec<F>, ProveError> {
    let data = std::fs::read(wtns_path)?;
    circomkit_core::utils::parse_witness_to_elems(&data, F::from_le_bytes_mod_order)
        .map_err(|e| ProveError::ProvingFailed(format!("failed to load witness: {e}")))
}

/// Create a Groth16 proof from a circuit and proving key.
pub fn prove_circuit(
    circuit: CircomCircuit<Fr>,
    pkey: &ProvingKey<Bn254>,
) -> Result<Proof<Bn254>, ProveError> {
    Groth16::<Bn254, CircomReduction>::create_random_proof_with_reduction(
        circuit,
        pkey,
        &mut thread_rng(),
    )
    .map_err(|e: SynthesisError| ProveError::ProvingFailed(format!("proof generation failed: {e}")))
}

/// Verify a Groth16 proof.
pub fn verify(
    proof: &Proof<Bn254>,
    public_inputs: &[Fr],
    proving_key: &ProvingKey<Bn254>,
) -> Result<bool, ProveError> {
    Groth16::<Bn254, CircomReduction>::verify_proof(
        &ark_groth16::prepare_verifying_key(&proving_key.vk),
        proof,
        public_inputs,
    )
    .map_err(|e: SynthesisError| {
        ProveError::VerificationFailed(format!("verification failed: {e}"))
    })
}
