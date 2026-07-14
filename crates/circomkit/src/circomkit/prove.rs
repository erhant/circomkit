use std::path::{Path, PathBuf};

use circomkit_core::enums::ProvingBackendKind;
use circomkit_core::error::{CoreError, Result};
use circomkit_core::functions::get_calldata;
use circomkit_core::types::CircuitSignals;
use circomkit_prove::{ProvingBackend, SetupBackend, make_proving_backend};
use circomkit_witness::{WitnessCalculator, WitnessError, make_witness_calculator};

use super::Circomkit;

/// Output from a trusted setup.
pub struct SetupOutput {
    pub pkey_path: PathBuf,
    pub vkey_path: PathBuf,
}

impl Circomkit {
    /// Build the configured witness calculator for a circuit, resolving the
    /// artifact paths (WASM module or native C binary) from the circuit's
    /// paths. Keeps path derivation in one place without coupling the witness
    /// crate to circomkit's path layout.
    pub(crate) fn witness_calculator(
        &self,
        circuit: &str,
    ) -> std::result::Result<Box<dyn WitnessCalculator>, WitnessError> {
        make_witness_calculator(
            self.config.witness.calculator,
            &self.paths.circuit_wasm(circuit),
            Some(&self.paths.circuit_c_binary(circuit)),
        )
    }

    /// Get or download the PTAU file for a circuit.
    pub fn ptau(&self, circuit: &str) -> Result<PathBuf> {
        let info = self.info(circuit)?;
        let ptau_name = circomkit_core::utils::ptau_name_for_constraints(info.constraints);

        if let Some(path) =
            circomkit_core::utils::ptau_path_if_exists(&ptau_name, &self.config.prover.ptau_dir)
        {
            return Ok(path);
        }

        circomkit_core::utils::download_ptau(&ptau_name, &self.config.prover.ptau_dir)
    }

    /// Run trusted setup for a circuit.
    pub fn setup(&self, circuit: &str, ptau_path: Option<&Path>) -> Result<SetupOutput> {
        let resolved = self.resolve(circuit)?;
        let protocol = resolved.prover.protocol;

        let ptau = match ptau_path {
            Some(p) => p.to_path_buf(),
            None => self.ptau(circuit)?,
        };

        let pkey_path = self.paths.pkey(circuit, protocol);
        let vkey_path = self.paths.vkey(circuit, protocol);

        self.snarkjs()
            .setup(
                &self.paths.circuit_r1cs(circuit),
                &ptau,
                &pkey_path,
                &resolved.prover,
            )
            .map_err(|e| CoreError::CompilationFailed(format!("setup failed: {e}")))?;

        self.snarkjs()
            .export_vkey(&pkey_path, &vkey_path)
            .map_err(|e| CoreError::CompilationFailed(format!("vkey export failed: {e}")))?;

        log::info!("setup complete for {circuit}");
        Ok(SetupOutput {
            pkey_path,
            vkey_path,
        })
    }

    /// Export verification key from an existing proving key.
    pub fn vkey(&self, circuit: &str) -> Result<PathBuf> {
        let protocol = self.config.prover.protocol;
        let pkey_path = self.paths.pkey(circuit, protocol);
        let vkey_path = self.paths.vkey(circuit, protocol);

        self.snarkjs()
            .export_vkey(&pkey_path, &vkey_path)
            .map_err(|e| CoreError::CompilationFailed(format!("vkey export failed: {e}")))?;

        Ok(vkey_path)
    }

    /// Export Solidity verifier contract.
    pub fn contract(&self, circuit: &str) -> Result<PathBuf> {
        let protocol = self.config.prover.protocol;
        let pkey_path = self.paths.pkey(circuit, protocol);
        let sol_path = self.paths.verifier_sol(circuit, protocol);

        self.snarkjs()
            .export_contract(&pkey_path, &sol_path, protocol)
            .map_err(|e| CoreError::CompilationFailed(format!("contract export failed: {e}")))?;

        log::info!("contract exported to {}", sol_path.display());
        Ok(sol_path)
    }

    /// Compute a witness for a circuit with the given input.
    pub fn witness(
        &self,
        circuit: &str,
        input: &str,
        data: Option<&CircuitSignals>,
    ) -> Result<PathBuf> {
        let prime = self.resolve(circuit)?.compiler.prime;

        let input_data = match data {
            Some(d) => d.clone(),
            None => self.load_input(circuit, input)?,
        };

        let calc = self
            .witness_calculator(circuit)
            .map_err(|e| CoreError::CompilationFailed(format!("witness calculator: {e}")))?;

        let witness = calc
            .calculate(&input_data)
            .map_err(|e| CoreError::CompilationFailed(format!("witness calculation: {e}")))?;

        let wtns_path = self.paths.witness_path(circuit, input);
        if let Some(parent) = wtns_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        circomkit_core::utils::write_witness_file(&wtns_path, &witness, prime)?;

        log::info!("witness computed for {circuit}/{input}");
        Ok(wtns_path)
    }

    /// Generate a proof for a circuit with the given input.
    ///
    /// The proving backend is taken from `backend` when provided (e.g. the CLI
    /// `--backend` flag), otherwise from the resolved circuit config
    /// (`prover.backend`). Either way it is capability-checked against the
    /// protocol and curve. snarkjs uses its one-shot `full_prove`; native
    /// backends (arkworks, lambdaworks) compute a witness first, then prove from it.
    pub fn prove(
        &self,
        circuit: &str,
        input: &str,
        data: Option<&CircuitSignals>,
        backend: Option<ProvingBackendKind>,
    ) -> Result<PathBuf> {
        let resolved = self.resolve(circuit)?;
        let protocol = resolved.prover.protocol;
        let kind = backend.unwrap_or(resolved.prover.backend);
        let prime = resolved.compiler.prime;

        let pkey_path = self.paths.pkey(circuit, protocol);

        // Capability check (protocol + curve) happens inside the factory.
        let backend = make_proving_backend(kind, protocol, prime)
            .map_err(|e| CoreError::CompilationFailed(format!("prove failed: {e}")))?;

        let output = if kind == ProvingBackendKind::Snarkjs {
            // One-shot: snarkjs computes the witness and proves in one subprocess.
            let input_data = match data {
                Some(d) => d.clone(),
                None => self.load_input(circuit, input)?,
            };
            let wasm_path = self.paths.circuit_wasm(circuit);
            backend
                .full_prove(&input_data, &wasm_path, &pkey_path)
                .map_err(|e| CoreError::CompilationFailed(format!("prove failed: {e}")))?
        } else {
            // Native backends prove from a pre-computed witness.
            let wtns_path = self.witness(circuit, input, data)?;
            let r1cs_path = self.paths.circuit_r1cs(circuit);
            backend
                .prove(&wtns_path, &r1cs_path, &pkey_path)
                .map_err(|e| CoreError::CompilationFailed(format!("prove failed: {e}")))?
        };

        let proof_path = self.paths.proof_path(circuit, input, protocol);
        let public_path = self.paths.public_signals_path(circuit, input);

        if let Some(parent) = proof_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&proof_path, serde_json::to_string_pretty(&output.proof)?)?;
        std::fs::write(
            &public_path,
            serde_json::to_string_pretty(&output.public_signals)?,
        )?;

        log::info!("proof generated for {circuit}/{input}");
        Ok(proof_path)
    }

    /// Verify a proof for a circuit with the given input.
    pub fn verify(&self, circuit: &str, input: &str) -> Result<bool> {
        let protocol = self.config.prover.protocol;
        let vkey_path = self.paths.vkey(circuit, protocol);
        let proof_path = self.paths.proof_path(circuit, input, protocol);
        let public_path = self.paths.public_signals_path(circuit, input);

        let vkey: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&vkey_path)?)?;
        let proof: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&proof_path)?)?;
        let public_signals: Vec<String> =
            serde_json::from_str(&std::fs::read_to_string(&public_path)?)?;

        let ok = self
            .snarkjs()
            .verify(&vkey, &public_signals, &proof)
            .map_err(|e| CoreError::CompilationFailed(format!("verify failed: {e}")))?;

        Ok(ok)
    }

    /// Generate calldata for a circuit proof.
    pub fn calldata(&self, circuit: &str, input: &str, pretty: bool) -> Result<String> {
        let protocol = self.config.prover.protocol;
        let proof_path = self.paths.proof_path(circuit, input, protocol);
        let public_path = self.paths.public_signals_path(circuit, input);

        let proof: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&proof_path)?)?;
        let public_signals: Vec<String> =
            serde_json::from_str(&std::fs::read_to_string(&public_path)?)?;

        get_calldata(&proof, &public_signals, pretty)
    }
}
