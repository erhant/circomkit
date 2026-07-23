use std::collections::HashMap;
use std::path::Path;

use num_bigint::BigInt;

use crate::error::{CoreError, Result};
use crate::types::{CircuitSignals, SignalValue, SymbolInfo, Symbols, Witness};

/// Parse a `.sym` file into a symbol table.
///
/// Each line has the format: `label_idx,var_idx,component_idx,symbol_name`
pub fn parse_symbols(path: &Path) -> Result<Symbols> {
    let content = std::fs::read_to_string(path)?;
    parse_symbols_str(&content)
}

/// Parse symbols from a string.
pub fn parse_symbols_str(content: &str) -> Result<Symbols> {
    let mut symbols = HashMap::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.splitn(4, ',').collect();
        if parts.len() < 4 {
            return Err(CoreError::InvalidSymbols(format!("malformed line: {line}")));
        }

        let label_idx: usize = parts[0]
            .parse()
            .map_err(|_| CoreError::InvalidSymbols(format!("invalid label_idx: {}", parts[0])))?;

        // Signed: circom writes `-1` for signals removed from the witness.
        let var_idx: isize = parts[1]
            .parse()
            .map_err(|_| CoreError::InvalidSymbols(format!("invalid var_idx: {}", parts[1])))?;
        let component_idx: usize = parts[2].parse().map_err(|_| {
            CoreError::InvalidSymbols(format!("invalid component_idx: {}", parts[2]))
        })?;
        let name = parts[3].to_string();

        symbols.insert(
            name,
            SymbolInfo {
                label_idx,
                var_idx,
                component_idx,
            },
        );
    }

    Ok(symbols)
}

/// Read signal values from a witness using the symbol table.
///
/// Handles both single signals (`main.out`) and array signals (`main.in`),
/// automatically collecting indexed entries like `main.in[0]`, `main.in[1]`, etc.
pub fn read_witness_signals(
    witness: &Witness,
    symbols: &Symbols,
    signals: &[&str],
) -> Result<CircuitSignals> {
    let mut result = CircuitSignals::new();

    for &signal in signals {
        let full_name = format!("main.{signal}");

        // Check for a direct match first
        if let Some(info) = symbols.get(&full_name)
            && let Some(w) = info.witness_index()
        {
            result.insert(signal.to_string(), SignalValue::Single(witness[w].clone()));
            continue;
        }

        // Try to collect array entries: main.signal[0], main.signal[1], ...
        let prefix = format!("{full_name}[");
        let mut indexed: Vec<(usize, BigInt)> = Vec::new();

        for (name, info) in symbols {
            if let Some(idx) = name
                .strip_prefix(&prefix)
                .and_then(|rest| rest.strip_suffix(']'))
                .and_then(|s| s.parse::<usize>().ok())
                && let Some(w) = info.witness_index()
            {
                indexed.push((idx, witness[w].clone()));
            }
        }

        if indexed.is_empty() {
            return Err(CoreError::SignalNotFound(signal.to_string()));
        }

        indexed.sort_by_key(|(idx, _)| *idx);
        let values: Vec<SignalValue> = indexed
            .into_iter()
            .map(|(_, v)| SignalValue::Single(v))
            .collect();
        result.insert(signal.to_string(), SignalValue::Array(values));
    }

    Ok(result)
}

/// Read raw symbol values from a witness by full symbol names.
pub fn read_witness_raw(
    witness: &Witness,
    symbols: &Symbols,
    symbol_names: &[&str],
) -> Result<HashMap<String, BigInt>> {
    let mut result = HashMap::new();

    for &name in symbol_names {
        let info = symbols
            .get(name)
            .ok_or_else(|| CoreError::SignalNotFound(name.to_string()))?;
        let w = info
            .witness_index()
            .ok_or_else(|| CoreError::SignalNotFound(name.to_string()))?;
        result.insert(name.to_string(), witness[w].clone());
    }

    Ok(result)
}

/// Edit witness values by symbol name (useful for soundness testing).
pub fn edit_witness(
    witness: &Witness,
    symbols: &Symbols,
    overrides: &HashMap<String, BigInt>,
) -> Result<Witness> {
    let mut edited = witness.clone();

    for (name, value) in overrides {
        let info = symbols
            .get(name)
            .ok_or_else(|| CoreError::SignalNotFound(name.clone()))?;
        let w = info
            .witness_index()
            .ok_or_else(|| CoreError::SignalNotFound(name.clone()))?;
        edited[w] = value.clone();
    }

    Ok(edited)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_sym_content() {
        // The last line has var_idx -1 (optimized out of the witness); it must
        // parse without error rather than aborting the whole file.
        let content = "1,1,0,main.in[0]\n2,2,0,main.in[1]\n3,3,0,main.out\n4,-1,0,main.tmp\n";
        let symbols = parse_symbols_str(content).unwrap();

        assert_eq!(symbols.len(), 4);
        assert_eq!(symbols["main.out"].var_idx, 3);
        assert_eq!(symbols["main.in[0]"].var_idx, 1);
        assert_eq!(symbols["main.tmp"].var_idx, -1);
        assert_eq!(symbols["main.tmp"].witness_index(), None);
        assert_eq!(symbols["main.out"].witness_index(), Some(3));
    }

    #[test]
    fn read_signals_single_and_array() {
        let content = "1,1,0,main.in[0]\n2,2,0,main.in[1]\n3,3,0,main.out\n";
        let symbols = parse_symbols_str(content).unwrap();
        let witness: Witness = vec![
            BigInt::from(0),
            BigInt::from(3),
            BigInt::from(5),
            BigInt::from(15),
        ];

        let signals = read_witness_signals(&witness, &symbols, &["in", "out"]).unwrap();

        assert_eq!(signals["out"], SignalValue::Single(BigInt::from(15)));
        assert_eq!(
            signals["in"],
            SignalValue::Array(vec![
                SignalValue::Single(BigInt::from(3)),
                SignalValue::Single(BigInt::from(5)),
            ])
        );
    }
}
