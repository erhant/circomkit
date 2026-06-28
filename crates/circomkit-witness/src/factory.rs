use std::path::Path;

use circomkit_core::enums::WitnessBackend;

use crate::WitnessCalculator;
use crate::WitnessError;

/// Create the appropriate witness calculator based on the configured backend.
pub fn make_witness_calculator(
    backend: WitnessBackend,
    wasm_path: &Path,
    _c_binary_path: Option<&Path>,
) -> Result<Box<dyn WitnessCalculator>, WitnessError> {
    match backend {
        #[cfg(feature = "witness-wasm")]
        WitnessBackend::Wasm => {
            let calc = crate::wasm::WasmWitnessCalculator::new(wasm_path.to_path_buf())?;
            Ok(Box::new(calc))
        }

        #[cfg(feature = "witness-c")]
        WitnessBackend::C => {
            let _ = (_c_binary_path, wasm_path);
            Err(WitnessError::Other(
                "C witness calculator not yet implemented".to_string(),
            ))
        }

        #[allow(unreachable_patterns)]
        _ => Err(WitnessError::Other(format!(
            "witness backend '{backend:?}' is not enabled via feature flags"
        ))),
    }
}
