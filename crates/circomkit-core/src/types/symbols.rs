use std::collections::HashMap;

/// Symbol table entry from a `.sym` file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SymbolInfo {
    pub label_idx: usize,
    /// Witness index.
    ///
    /// Circom writes `-1` for signals the optimizer removed from the witness
    /// (constants / eliminated intermediates), so this is signed.
    pub var_idx: isize,
    pub component_idx: usize,
}

impl SymbolInfo {
    /// The witness-array index for this signal, or `None` if it was optimized
    /// out of the witness (`var_idx == -1`).
    pub fn witness_index(&self) -> Option<usize> {
        (self.var_idx >= 0).then_some(self.var_idx as usize)
    }
}

/// Symbol table: maps full symbol names (e.g. `main.signal[0]`) to their metadata.
pub type Symbols = HashMap<String, SymbolInfo>;
