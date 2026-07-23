use std::path::Path;
use std::process::Command;

use circomkit_core::config::ProverConfig;
use circomkit_core::enums::Protocol;
use circomkit_core::types::CircuitSignals;

use crate::error::ProveError;
use crate::traits::{ProvingBackend, SetupBackend};
use crate::types::ProofOutput;

/// Proving backend that delegates to the `snarkjs` CLI via subprocess.
pub struct SnarkjsBackend {
    /// Command to invoke snarkjs (e.g. "snarkjs" or "npx snarkjs").
    snarkjs_cmd: String,
    /// Protocol to use for proving.
    protocol: Protocol,
}

impl Default for SnarkjsBackend {
    fn default() -> Self {
        Self {
            snarkjs_cmd: "snarkjs".to_string(),
            protocol: Protocol::Groth16,
        }
    }
}

impl SnarkjsBackend {
    pub fn new(cmd: impl Into<String>, protocol: Protocol) -> Self {
        Self {
            snarkjs_cmd: cmd.into(),
            protocol,
        }
    }

    fn protocol_cmd(&self) -> &str {
        match self.protocol {
            Protocol::Groth16 => "groth16",
            Protocol::Plonk => "plonk",
            Protocol::Fflonk => "fflonk",
        }
    }

    fn run(&self, args: &[&str]) -> Result<String, ProveError> {
        log::debug!("{} {}", self.snarkjs_cmd, args.join(" "));

        let output = Command::new(&self.snarkjs_cmd)
            .args(args)
            .output()
            .map_err(|e| ProveError::SnarkjsError(format!("failed to run snarkjs: {e}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(ProveError::SnarkjsError(format!(
                "snarkjs exited with {}:\nstdout: {stdout}\nstderr: {stderr}",
                output.status
            )));
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}

impl ProvingBackend for SnarkjsBackend {
    fn capabilities(&self) -> crate::capabilities::BackendCapabilities {
        crate::capabilities::capabilities_for(circomkit_core::enums::ProvingBackendKind::Snarkjs)
    }

    fn full_prove(
        &self,
        input: &CircuitSignals,
        wasm_path: &Path,
        pkey_path: &Path,
    ) -> Result<ProofOutput, ProveError> {
        let tmp_dir = tempfile::tempdir()?;
        let input_path = tmp_dir.path().join("input.json");
        let proof_path = tmp_dir.path().join("proof.json");
        let public_path = tmp_dir.path().join("public.json");

        std::fs::write(&input_path, serde_json::to_string(input)?)?;

        self.run(&[
            self.protocol_cmd(),
            "fullprove",
            &input_path.to_string_lossy(),
            &wasm_path.to_string_lossy(),
            &pkey_path.to_string_lossy(),
            &proof_path.to_string_lossy(),
            &public_path.to_string_lossy(),
        ])?;

        let proof: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&proof_path)?)?;
        let public_signals: Vec<String> =
            serde_json::from_str(&std::fs::read_to_string(&public_path)?)?;

        Ok(ProofOutput {
            proof,
            public_signals,
        })
    }

    fn prove(
        &self,
        witness_path: &Path,
        _r1cs_path: &Path,
        pkey_path: &Path,
    ) -> Result<ProofOutput, ProveError> {
        let tmp_dir = tempfile::tempdir()?;
        let proof_path = tmp_dir.path().join("proof.json");
        let public_path = tmp_dir.path().join("public.json");

        self.run(&[
            self.protocol_cmd(),
            "prove",
            &pkey_path.to_string_lossy(),
            &witness_path.to_string_lossy(),
            &proof_path.to_string_lossy(),
            &public_path.to_string_lossy(),
        ])?;

        let proof: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&proof_path)?)?;
        let public_signals: Vec<String> =
            serde_json::from_str(&std::fs::read_to_string(&public_path)?)?;

        Ok(ProofOutput {
            proof,
            public_signals,
        })
    }

    fn verify(
        &self,
        vkey: &serde_json::Value,
        public_signals: &[String],
        proof: &serde_json::Value,
    ) -> Result<bool, ProveError> {
        let tmp_dir = tempfile::tempdir()?;
        let vkey_path = tmp_dir.path().join("vkey.json");
        let proof_path = tmp_dir.path().join("proof.json");
        let public_path = tmp_dir.path().join("public.json");

        std::fs::write(&vkey_path, serde_json::to_string(vkey)?)?;
        std::fs::write(&proof_path, serde_json::to_string(proof)?)?;
        std::fs::write(&public_path, serde_json::to_string(public_signals)?)?;

        // For verify, snarkjs exits 1 on invalid proof — that's not an error,
        // it means the proof is rejected. We check stdout for "OK!" instead.
        let output = Command::new(&self.snarkjs_cmd)
            .args([
                self.protocol_cmd(),
                "verify",
                &vkey_path.to_string_lossy(),
                &public_path.to_string_lossy(),
                &proof_path.to_string_lossy(),
            ])
            .output()
            .map_err(|e| ProveError::SnarkjsError(format!("failed to run snarkjs: {e}")))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.contains("OK!"))
    }
}

impl SetupBackend for SnarkjsBackend {
    fn setup(
        &self,
        r1cs_path: &Path,
        ptau_path: &Path,
        pkey_path: &Path,
        config: &ProverConfig,
    ) -> Result<(), ProveError> {
        match config.protocol {
            Protocol::Groth16 => {
                let tmp_dir = tempfile::tempdir()?;
                let mut current_zkey = tmp_dir.path().join("circuit_0.zkey");

                // snarkjs groth16 setup is actually "zkey new"
                self.run(&[
                    "groth16",
                    "setup",
                    &r1cs_path.to_string_lossy(),
                    &ptau_path.to_string_lossy(),
                    &current_zkey.to_string_lossy(),
                ])?;

                // Phase-2 contributions
                for i in 0..config.groth16.num_contributions {
                    let next_zkey = tmp_dir.path().join(format!("circuit_{}.zkey", i + 1));
                    let name = format!("contribution_{}", i + 1);

                    self.run(&[
                        "zkey",
                        "contribute",
                        &current_zkey.to_string_lossy(),
                        &next_zkey.to_string_lossy(),
                        &format!("--name={name}"),
                        "-e=random_entropy",
                    ])?;

                    current_zkey = next_zkey;
                }

                if let Some(parent) = pkey_path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                std::fs::rename(&current_zkey, pkey_path)?;
            }
            Protocol::Plonk | Protocol::Fflonk => {
                if let Some(parent) = pkey_path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                self.run(&[
                    self.protocol_cmd(),
                    "setup",
                    &r1cs_path.to_string_lossy(),
                    &ptau_path.to_string_lossy(),
                    &pkey_path.to_string_lossy(),
                ])?;
            }
        }

        Ok(())
    }

    fn export_vkey(&self, pkey_path: &Path, vkey_path: &Path) -> Result<(), ProveError> {
        if let Some(parent) = vkey_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        self.run(&[
            "zkey",
            "export",
            "verificationkey",
            &pkey_path.to_string_lossy(),
            &vkey_path.to_string_lossy(),
        ])?;
        Ok(())
    }

    fn export_contract(
        &self,
        pkey_path: &Path,
        sol_path: &Path,
        _protocol: Protocol,
    ) -> Result<(), ProveError> {
        if let Some(parent) = sol_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        self.run(&[
            "zkey",
            "export",
            "solidityverifier",
            &pkey_path.to_string_lossy(),
            &sol_path.to_string_lossy(),
        ])?;
        Ok(())
    }
}
