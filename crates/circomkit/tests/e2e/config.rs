use circomkit::core::config::CircomkitConfig;

use super::common::test_circomkit;

#[test]
fn load_test_config() {
    let (ck, _guard) = test_circomkit();
    assert_eq!(ck.config.circuits.len(), 5);
    assert!(ck.config.circuits.contains_key("multiplier_3"));
    assert!(ck.config.circuits.contains_key("arrays_2_3"));
    assert!(ck.config.circuits.contains_key("errors"));
    assert!(ck.config.circuits.contains_key("custom_mul"));
    assert!(ck.config.circuits.contains_key("bounded_add_8"));
}

#[test]
fn resolve_circuit_config() {
    let (ck, _guard) = test_circomkit();
    let resolved = ck.config.resolve_circuit("multiplier_3").unwrap();
    assert_eq!(resolved.circuit.template, "Multiplier");
    assert_eq!(resolved.circuit.file, "multiplier");
}

#[test]
fn nonexistent_circuit_errors() {
    let (ck, _guard) = test_circomkit();
    let result = ck.config.resolve_circuit("nonexistent");
    assert!(result.is_err());
}

#[test]
fn json_schema_is_valid() {
    let schema = CircomkitConfig::json_schema();
    let json = serde_json::to_string_pretty(&schema).unwrap();
    assert!(json.contains("CircomkitConfig"));
    assert!(json.contains("circuits"));
    assert!(json.contains("prover"));
    assert!(json.contains("compiler"));
}

#[test]
fn paths_resolve_correctly() {
    let (ck, _guard) = test_circomkit();
    let r1cs = ck.paths.circuit_r1cs("multiplier_3");
    assert!(r1cs.to_string_lossy().contains("multiplier_3"));
    assert!(r1cs.to_string_lossy().ends_with(".r1cs"));
}

#[test]
fn load_input_from_file() {
    let (ck, _guard) = test_circomkit();
    let input = ck.load_input("multiplier_3", "default").unwrap();
    assert!(input.contains_key("in"));
}
