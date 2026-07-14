use circomkit_core::config::CircuitConfig;
use circomkit_core::enums::Protocol;
use circomkit_prove::SnarkjsBackend;
use circomkit_test::{ProofTester, WitnessTester};

use super::Circomkit;

impl Circomkit {
    /// Create a WitnessTester for a circuit.
    pub fn witness_tester(
        &self,
        circuit: &str,
        config: CircuitConfig,
    ) -> std::result::Result<WitnessTester, circomkit_test::TestError> {
        // Ensure circuit is compiled
        self.compile(circuit)
            .map_err(circomkit_test::TestError::Core)?;

        let calc = self.witness_calculator(circuit)?;

        let _ = config;
        Ok(WitnessTester::new(
            calc,
            self.paths.circuit_r1cs(circuit),
            self.paths.circuit_sym(circuit),
        ))
    }

    /// Create a ProofTester for a circuit.
    pub fn proof_tester(
        &self,
        circuit: &str,
        protocol: Protocol,
    ) -> std::result::Result<ProofTester, circomkit_test::TestError> {
        let backend = Box::new(SnarkjsBackend::new("snarkjs", protocol));
        ProofTester::new(
            backend,
            self.paths.circuit_wasm(circuit),
            self.paths.pkey(circuit, protocol),
            self.paths.vkey(circuit, protocol),
            protocol,
        )
    }
}
