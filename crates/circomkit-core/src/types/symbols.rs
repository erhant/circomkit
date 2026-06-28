use std::collections::HashMap;

/// Symbol table entry from a `.sym` file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SymbolInfo {
    pub label_idx: usize,
    pub var_idx: usize,
    pub component_idx: usize,
}

/// Symbol table: maps full symbol names (e.g. `main.signal[0]`) to their metadata.
pub type Symbols = HashMap<String, SymbolInfo>;
