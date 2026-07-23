use std::path::Path;

use circomkit_core::enums::WitnessBackend;

use crate::WitnessCalculator;
use crate::WitnessError;

/// Create the appropriate witness calculator based on the configured backend.
///
/// `wasm_path` is used by the WASM backend; `c_binary_path` (the compiled
/// `{circuit}_cpp/{circuit}` binary) is used by the C backend.
pub fn make_witness_calculator(
    backend: WitnessBackend,
    wasm_path: &Path,
    c_binary_path: Option<&Path>,
) -> Result<Box<dyn WitnessCalculator>, WitnessError> {
    match backend {
        #[cfg(feature = "witness-wasm")]
        WitnessBackend::Wasm => {
            let calc = crate::wasm::WasmWitnessCalculator::new(wasm_path.to_path_buf())?;
            Ok(Box::new(calc))
        }

        #[cfg(not(feature = "witness-wasm"))]
        WitnessBackend::Wasm => {
            let _ = wasm_path;
            Err(WitnessError::Other(
                "WASM witness backend is not enabled (feature `witness-wasm`)".to_string(),
            ))
        }

        #[cfg(feature = "witness-c")]
        WitnessBackend::C => {
            let binary = c_binary_path.ok_or_else(|| {
                WitnessError::Other(
                    "C witness backend selected but no binary path was provided".to_string(),
                )
            })?;
            let calc = crate::c::CWitnessCalculator::new(binary.to_path_buf())?;
            Ok(Box::new(calc))
        }

        #[cfg(not(feature = "witness-c"))]
        WitnessBackend::C => {
            let _ = c_binary_path;
            Err(WitnessError::Other(
                "C witness backend is not enabled (feature `witness-c`)".to_string(),
            ))
        }
    }
}
