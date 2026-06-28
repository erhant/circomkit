use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use num_bigint::BigInt;

use circomkit_core::functions::{edit_witness, parse_symbols, read_witness_signals};
use circomkit_core::types::{CircuitSignals, R1CSInfo, Symbols, Witness};
use circomkit_core::utils::read_r1cs_info;
use circomkit_witness::WitnessCalculator;

use crate::error::TestError;

/// A circuit tester focused on witness-level testing.
///
/// Supports computing witnesses, checking outputs, asserting failures,
/// reading signals, editing witnesses for soundness testing, and
/// inspecting constraint counts.
pub struct WitnessTester {
    calculator: Box<dyn WitnessCalculator>,
    symbols: OnceLock<Mutex<Option<Symbols>>>,
    r1cs_info: OnceLock<Mutex<Option<R1CSInfo>>>,
    r1cs_path: PathBuf,
    sym_path: PathBuf,
}

impl WitnessTester {
    pub fn new(
        calculator: Box<dyn WitnessCalculator>,
        r1cs_path: PathBuf,
        sym_path: PathBuf,
    ) -> Self {
        Self {
            calculator,
            symbols: OnceLock::new(),
            r1cs_info: OnceLock::new(),
            r1cs_path,
            sym_path,
        }
    }

    /// Compute a witness from input signals.
    pub fn calculate_witness(&self, input: &CircuitSignals) -> Result<Witness, TestError> {
        Ok(self.calculator.calculate(input)?)
    }

    /// Get R1CS info (lazily loaded).
    pub fn r1cs_info(&self) -> Result<R1CSInfo, TestError> {
        let mutex = self.r1cs_info.get_or_init(|| Mutex::new(None));
        let mut guard = mutex.lock().unwrap();
        if guard.is_none() {
            *guard = Some(read_r1cs_info(&self.r1cs_path)?);
        }
        Ok(guard.as_ref().unwrap().clone())
    }

    /// Get the symbol table (lazily loaded).
    pub fn symbols(&self) -> Result<Symbols, TestError> {
        let mutex = self.symbols.get_or_init(|| Mutex::new(None));
        let mut guard = mutex.lock().unwrap();
        if guard.is_none() {
            *guard = Some(parse_symbols(&self.sym_path)?);
        }
        Ok(guard.as_ref().unwrap().clone())
    }

    /// Get the constraint count.
    pub fn constraint_count(&self) -> Result<u32, TestError> {
        Ok(self.r1cs_info()?.constraints)
    }

    /// Assert the constraint count.
    ///
    /// If `exact` is true, asserts equality. Otherwise asserts `actual >= expected`.
    pub fn expect_constraint_count(&self, expected: u32, exact: bool) -> Result<(), TestError> {
        let actual = self.constraint_count()?;
        if exact && actual != expected {
            return Err(TestError::ConstraintCountMismatch { expected, actual });
        }
        if !exact && actual < expected {
            return Err(TestError::UnderConstrained { expected, actual });
        }
        Ok(())
    }

    /// Expect the input to produce a valid witness.
    ///
    /// If `output` is provided, also checks that the output signals match.
    pub fn expect_pass(
        &self,
        input: &CircuitSignals,
        output: Option<&CircuitSignals>,
    ) -> Result<(), TestError> {
        let witness = self.calculate_witness(input)?;

        if let Some(expected) = output {
            let symbols = self.symbols()?;
            let signal_names: Vec<&str> = expected.keys().map(|s| s.as_str()).collect();
            let actual = read_witness_signals(&witness, &symbols, &signal_names)?;

            for (name, expected_val) in expected {
                let actual_val = actual.get(name).ok_or_else(|| TestError::OutputMismatch {
                    signal: name.clone(),
                    expected: format!("{expected_val:?}"),
                    actual: "not found".to_string(),
                })?;

                if expected_val != actual_val {
                    return Err(TestError::OutputMismatch {
                        signal: name.clone(),
                        expected: format!("{expected_val:?}"),
                        actual: format!("{actual_val:?}"),
                    });
                }
            }
        }

        Ok(())
    }

    /// Expect witness computation to fail with a circuit error.
    ///
    /// Returns the error message on success.
    pub fn expect_fail(&self, input: &CircuitSignals) -> Result<String, TestError> {
        match self.calculator.calculate(input) {
            Err(e) if e.is_circuit_error() => Ok(e.to_string()),
            Err(e) => Err(TestError::Witness(e)),
            Ok(_) => Err(TestError::ExpectedFailure),
        }
    }

    /// Compute a witness and read specific output signals.
    pub fn compute(
        &self,
        input: &CircuitSignals,
        signals: &[&str],
    ) -> Result<CircuitSignals, TestError> {
        let witness = self.calculate_witness(input)?;
        let symbols = self.symbols()?;
        Ok(read_witness_signals(&witness, &symbols, signals)?)
    }

    /// Read signal values from a pre-computed witness.
    pub fn read_witness_signals(
        &self,
        witness: &Witness,
        signals: &[&str],
    ) -> Result<CircuitSignals, TestError> {
        let symbols = self.symbols()?;
        Ok(read_witness_signals(witness, &symbols, signals)?)
    }

    /// Read raw symbol values from a witness by full symbol names.
    pub fn read_witness(
        &self,
        witness: &Witness,
        symbol_names: &[&str],
    ) -> Result<HashMap<String, BigInt>, TestError> {
        let symbols = self.symbols()?;
        Ok(circomkit_core::functions::read_witness_raw(
            witness,
            &symbols,
            symbol_names,
        )?)
    }

    /// Edit witness values by symbol name (for soundness testing).
    pub fn edit_witness(
        &self,
        witness: &Witness,
        overrides: &HashMap<String, BigInt>,
    ) -> Result<Witness, TestError> {
        let symbols = self.symbols()?;
        Ok(edit_witness(witness, &symbols, overrides)?)
    }
}
