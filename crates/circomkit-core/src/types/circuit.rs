use num_bigint::BigInt;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::HashMap;

/// A signal value: either a single field element or a nested array.
///
/// When serialized to JSON, single values are written as decimal strings
/// (e.g. `"42"`) for compatibility with snarkjs. Arrays are regular JSON arrays.
/// Deserialization accepts both numbers and strings.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SignalValue {
    Single(BigInt),
    Array(Vec<SignalValue>),
}

impl Serialize for SignalValue {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            SignalValue::Single(v) => {
                if let Ok(n) = i64::try_from(v) {
                    serializer.serialize_i64(n)
                } else {
                    serializer.serialize_str(&v.to_string())
                }
            }
            SignalValue::Array(arr) => arr.serialize(serializer),
        }
    }
}

impl<'de> Deserialize<'de> for SignalValue {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = serde_json::Value::deserialize(deserializer)?;
        signal_from_json(&value).map_err(serde::de::Error::custom)
    }
}

fn signal_from_json(value: &serde_json::Value) -> Result<SignalValue, String> {
    match value {
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Ok(SignalValue::Single(BigInt::from(i)))
            } else if let Some(u) = n.as_u64() {
                Ok(SignalValue::Single(BigInt::from(u)))
            } else {
                Err(format!("unsupported number: {n}"))
            }
        }
        serde_json::Value::String(s) => s
            .parse::<BigInt>()
            .map(SignalValue::Single)
            .map_err(|e| format!("invalid BigInt string '{s}': {e}")),
        serde_json::Value::Array(arr) => {
            let items: Result<Vec<_>, _> = arr.iter().map(signal_from_json).collect();
            Ok(SignalValue::Array(items?))
        }
        _ => Err(format!("unexpected JSON value for signal: {value}")),
    }
}

impl From<i64> for SignalValue {
    fn from(v: i64) -> Self {
        Self::Single(BigInt::from(v))
    }
}

impl From<u64> for SignalValue {
    fn from(v: u64) -> Self {
        Self::Single(BigInt::from(v))
    }
}

impl From<i32> for SignalValue {
    fn from(v: i32) -> Self {
        Self::Single(BigInt::from(v))
    }
}

impl From<u32> for SignalValue {
    fn from(v: u32) -> Self {
        Self::Single(BigInt::from(v))
    }
}

impl From<BigInt> for SignalValue {
    fn from(v: BigInt) -> Self {
        Self::Single(v)
    }
}

impl<T: Into<SignalValue>> From<Vec<T>> for SignalValue {
    fn from(v: Vec<T>) -> Self {
        Self::Array(v.into_iter().map(Into::into).collect())
    }
}

impl<T: Into<SignalValue> + Clone> From<&[T]> for SignalValue {
    fn from(v: &[T]) -> Self {
        Self::Array(v.iter().cloned().map(Into::into).collect())
    }
}

/// Circuit input/output signals: a map from signal name to value.
pub type CircuitSignals = HashMap<String, SignalValue>;

/// A witness: vector of field elements.
pub type Witness = Vec<BigInt>;

/// Convenience macro for building `CircuitSignals`.
///
/// # Examples
///
/// ```
/// use circomkit_core::signals;
///
/// let s = signals! {
///     "in" => vec![3_i64, 5, 7],
///     "out" => 105_i64,
/// };
/// ```
#[macro_export]
macro_rules! signals {
    ($($key:literal => $val:expr),* $(,)?) => {{
        let mut map = std::collections::HashMap::new();
        $(map.insert($key.to_string(), $crate::types::SignalValue::from($val));)*
        map
    }};
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialize_signals_as_json() {
        let input = crate::signals! {
            "in" => vec![2_i64, 3, 5],
            "out" => 30_i64,
        };
        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("[2,3,5]") || json.contains("[2, 3, 5]"));
        assert!(json.contains("30"));
        assert!(!json.contains("BigInt"));
    }

    #[test]
    fn deserialize_signals_from_json() {
        let json = r#"{"in": [2, 3, 5], "out": 30}"#;
        let signals: CircuitSignals = serde_json::from_str(json).unwrap();
        assert_eq!(signals["out"], SignalValue::Single(BigInt::from(30)));
    }

    #[test]
    fn deserialize_string_signals() {
        let json = r#"{"val": "12345678901234567890"}"#;
        let signals: CircuitSignals = serde_json::from_str(json).unwrap();
        let expected = "12345678901234567890".parse::<BigInt>().unwrap();
        assert_eq!(signals["val"], SignalValue::Single(expected));
    }
}
