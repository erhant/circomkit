use std::path::PathBuf;

use crate::config::CircomkitConfig;
use crate::enums::Protocol;

/// Resolves all filesystem paths for circomkit artifacts.
#[derive(Debug, Clone)]
pub struct CircomkitPaths {
    // TODO: can this be static perhaps?
    // path lives as long as the Circomkit instance, so we can store refs instead of owned Paths if needed
    src_dir: PathBuf,
    out_dir: PathBuf,
    input_dir: PathBuf,
    ptau_dir: PathBuf,
}

impl CircomkitPaths {
    pub fn new(config: &CircomkitConfig) -> Self {
        Self {
            src_dir: config.compiler.src_dir.clone(),
            out_dir: config.compiler.out_dir.clone(),
            input_dir: config.prover.input_dir.clone(),
            ptau_dir: config.prover.ptau_dir.clone(),
        }
    }

    // ---- Circuit-level paths ----

    /// Build directory for a circuit: `{out_dir}/{circuit}`
    pub fn circuit_dir(&self, circuit: &str) -> PathBuf {
        self.out_dir.join(circuit)
    }

    /// R1CS file: `{out_dir}/{circuit}/{circuit}.r1cs`
    pub fn circuit_r1cs(&self, circuit: &str) -> PathBuf {
        self.circuit_dir(circuit).join(format!("{circuit}.r1cs"))
    }

    /// Symbol file: `{out_dir}/{circuit}/{circuit}.sym`
    pub fn circuit_sym(&self, circuit: &str) -> PathBuf {
        self.circuit_dir(circuit).join(format!("{circuit}.sym"))
    }

    /// WASM file: `{out_dir}/{circuit}/{circuit}_js/{circuit}.wasm`
    pub fn circuit_wasm(&self, circuit: &str) -> PathBuf {
        self.circuit_dir(circuit)
            .join(format!("{circuit}_js"))
            .join(format!("{circuit}.wasm"))
    }

    /// Main component source file: `{src_dir}/main/{circuit}.circom`
    pub fn circuit_main(&self, circuit: &str) -> PathBuf {
        self.src_dir.join("main").join(format!("{circuit}.circom"))
    }

    /// Original circuit template source file: `{src_dir}/{file}.circom`
    pub fn circuit_source(&self, file: &str) -> PathBuf {
        self.src_dir.join(format!("{file}.circom"))
    }

    /// C witness calculator directory: `{out_dir}/{circuit}/{circuit}_cpp`
    pub fn circuit_c_dir(&self, circuit: &str) -> PathBuf {
        self.circuit_dir(circuit).join(format!("{circuit}_cpp"))
    }

    /// Compiled C witness binary: `{out_dir}/{circuit}/{circuit}_cpp/{circuit}`
    pub fn circuit_c_binary(&self, circuit: &str) -> PathBuf {
        self.circuit_c_dir(circuit).join(circuit)
    }

    // ---- Protocol-dependent paths ----

    /// Prover key: `{out_dir}/{circuit}/{protocol}_pkey.zkey`
    pub fn pkey(&self, circuit: &str, protocol: Protocol) -> PathBuf {
        self.circuit_dir(circuit)
            .join(format!("{protocol}_pkey.zkey"))
    }

    /// Verification key: `{out_dir}/{circuit}/{protocol}_vkey.json`
    pub fn vkey(&self, circuit: &str, protocol: Protocol) -> PathBuf {
        self.circuit_dir(circuit)
            .join(format!("{protocol}_vkey.json"))
    }

    /// Solidity verifier contract: `{out_dir}/{circuit}/{protocol}_verifier.sol`
    pub fn verifier_sol(&self, circuit: &str, protocol: Protocol) -> PathBuf {
        self.circuit_dir(circuit)
            .join(format!("{protocol}_verifier.sol"))
    }

    // ---- Input-dependent paths ----

    /// Input-specific output directory: `{out_dir}/{circuit}/{input}`
    pub fn input_dir(&self, circuit: &str, input: &str) -> PathBuf {
        self.circuit_dir(circuit).join(input)
    }

    /// Witness file: `{out_dir}/{circuit}/{input}/witness.wtns`
    pub fn witness_path(&self, circuit: &str, input: &str) -> PathBuf {
        self.input_dir(circuit, input).join("witness.wtns")
    }

    /// Proof file: `{out_dir}/{circuit}/{input}/{protocol}_proof.json`
    pub fn proof_path(&self, circuit: &str, input: &str, protocol: Protocol) -> PathBuf {
        self.input_dir(circuit, input)
            .join(format!("{protocol}_proof.json"))
    }

    /// Public signals file: `{out_dir}/{circuit}/{input}/public.json`
    pub fn public_signals_path(&self, circuit: &str, input: &str) -> PathBuf {
        self.input_dir(circuit, input).join("public.json")
    }

    // ---- Other paths ----

    /// Input JSON file: `{input_dir}/{circuit}/{input}.json`
    pub fn input_json(&self, circuit: &str, input: &str) -> PathBuf {
        self.input_dir.join(circuit).join(format!("{input}.json"))
    }

    /// Flat input JSON fallback: `{input_dir}/{circuit}.json`
    ///
    /// A convenience layout for circuits with a single input, avoiding the
    /// per-circuit subdirectory. Used as a fallback when the per-input file
    /// under [`input_json`](Self::input_json) does not exist.
    pub fn input_json_flat(&self, circuit: &str) -> PathBuf {
        self.input_dir.join(format!("{circuit}.json"))
    }

    /// PTAU file: `{ptau_dir}/{ptau_name}`
    pub fn ptau(&self, ptau_name: &str) -> PathBuf {
        self.ptau_dir.join(ptau_name)
    }

    /// Intermediate zkey: `{out_dir}/{circuit}/{circuit}_{id}.zkey`
    pub fn zkey(&self, circuit: &str, id: u32) -> PathBuf {
        self.circuit_dir(circuit)
            .join(format!("{circuit}_{id}.zkey"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> CircomkitConfig {
        CircomkitConfig::default()
    }

    #[test]
    fn circuit_artifact_paths() {
        let paths = CircomkitPaths::new(&test_config());

        assert_eq!(
            paths.circuit_r1cs("mul"),
            PathBuf::from("./build/mul/mul.r1cs")
        );
        assert_eq!(
            paths.circuit_sym("mul"),
            PathBuf::from("./build/mul/mul.sym")
        );
        assert_eq!(
            paths.circuit_wasm("mul"),
            PathBuf::from("./build/mul/mul_js/mul.wasm")
        );
        assert_eq!(
            paths.circuit_main("mul"),
            PathBuf::from("./circuits/main/mul.circom")
        );
    }

    #[test]
    fn protocol_dependent_paths() {
        let paths = CircomkitPaths::new(&test_config());

        assert_eq!(
            paths.pkey("mul", Protocol::Groth16),
            PathBuf::from("./build/mul/groth16_pkey.zkey")
        );
        assert_eq!(
            paths.vkey("mul", Protocol::Plonk),
            PathBuf::from("./build/mul/plonk_vkey.json")
        );
    }

    #[test]
    fn input_dependent_paths() {
        let paths = CircomkitPaths::new(&test_config());

        assert_eq!(
            paths.witness_path("mul", "test"),
            PathBuf::from("./build/mul/test/witness.wtns")
        );
        assert_eq!(
            paths.proof_path("mul", "test", Protocol::Groth16),
            PathBuf::from("./build/mul/test/groth16_proof.json")
        );
        assert_eq!(
            paths.input_json("mul", "test"),
            PathBuf::from("./inputs/mul/test.json")
        );
        assert_eq!(
            paths.input_json_flat("mul"),
            PathBuf::from("./inputs/mul.json")
        );
    }

    #[test]
    fn zkey_path() {
        let paths = CircomkitPaths::new(&test_config());
        assert_eq!(
            paths.zkey("mul", 0),
            PathBuf::from("./build/mul/mul_0.zkey")
        );
    }
}
