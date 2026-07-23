use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::enums::WitnessBackend;

/// Witness generation configuration.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
#[serde(default, rename_all = "camelCase")]
pub struct WitnessConfig {
    /// Which witness calculator backend to use.
    pub calculator: WitnessBackend,
}
