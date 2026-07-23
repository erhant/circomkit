mod error;
mod factory;
mod traits;

#[cfg(feature = "witness-c")]
mod c;

#[cfg(feature = "witness-wasm")]
mod wasm;

pub use error::WitnessError;
pub use factory::make_witness_calculator;
pub use traits::WitnessCalculator;

#[cfg(feature = "witness-c")]
pub use c::CWitnessCalculator;

#[cfg(feature = "witness-wasm")]
pub use wasm::WasmWitnessCalculator;
