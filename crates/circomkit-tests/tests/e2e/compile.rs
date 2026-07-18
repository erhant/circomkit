use circomkit::Circomkit;
use circomkit::core::config::CircomkitConfig;

use super::common::{test_circomkit, test_lock, workspace_root};

#[test]
fn compile_multiplier() {
    let (ck, _guard) = test_circomkit();
    let out = ck.compile("multiplier_3").unwrap();
    assert!(out.exists());
    assert!(ck.paths.circuit_r1cs("multiplier_3").exists());
    assert!(ck.paths.circuit_wasm("multiplier_3").exists());
    assert!(ck.paths.circuit_sym("multiplier_3").exists());
}

#[test]
fn compile_arrays() {
    let (ck, _guard) = test_circomkit();
    let out = ck.compile("arrays_2_3").unwrap();
    assert!(out.exists());
}

#[test]
fn compile_errors() {
    let (ck, _guard) = test_circomkit();
    let out = ck.compile("errors").unwrap();
    assert!(out.exists());
}

#[test]
fn info_multiplier() {
    let (ck, _guard) = test_circomkit();
    ck.compile("multiplier_3").unwrap();
    let info = ck.info("multiplier_3").unwrap();

    // Multiplier(3) with optimization=0 has 15 constraints
    assert_eq!(info.constraints, 15);
    assert!(info.wires > 0);
    assert!(info.prime_name.is_some());
}

#[test]
fn clear_removes_artifacts() {
    let (ck, _guard) = test_circomkit();
    ck.compile("errors").unwrap();
    let dir = ck.paths.circuit_dir("errors");
    assert!(dir.exists());

    ck.clear("errors").unwrap();
    assert!(!dir.exists());
}

#[test]
fn source_mtime_not_modified_by_compile() {
    let (ck, _guard) = test_circomkit();
    let source_path = ck.paths.circuit_source("multiplier");
    assert!(source_path.exists(), "source .circom file must exist");

    let mtime_before = source_path.metadata().unwrap().modified().unwrap();
    ck.compile("multiplier_3").unwrap();
    let mtime_after = source_path.metadata().unwrap().modified().unwrap();

    assert_eq!(
        mtime_before, mtime_after,
        "compilation must not modify the source .circom file's mtime"
    );
}

#[test]
fn skips_compilation_when_build_is_fresh() {
    let (ck, _guard) = test_circomkit();

    // Start clean so we own the artifact timestamps
    ck.clear("multiplier_3").unwrap();

    // First compile to create artifacts
    ck.compile("multiplier_3").unwrap();
    let r1cs_path = ck.paths.circuit_r1cs("multiplier_3");
    assert!(r1cs_path.exists());
    let mtime_after_first = r1cs_path.metadata().unwrap().modified().unwrap();

    // Second compile should skip (recompile defaults to false)
    // Sleep briefly so we can detect if the file was rewritten
    std::thread::sleep(std::time::Duration::from_millis(100));
    ck.compile("multiplier_3").unwrap();
    let mtime_after_second = r1cs_path.metadata().unwrap().modified().unwrap();

    assert_eq!(
        mtime_after_first, mtime_after_second,
        "r1cs mtime should not change when build is fresh"
    );
}

#[test]
fn compile_custom_templates() {
    let (ck, _guard) = test_circomkit();
    let out = ck.compile("custom_mul").unwrap();
    assert!(out.exists());
    assert!(ck.paths.circuit_r1cs("custom_mul").exists());
    assert!(ck.paths.circuit_wasm("custom_mul").exists());

    // Verify the generated main file includes pragma custom_templates
    let main_path = ck.paths.circuit_main("custom_mul");
    let main_source = std::fs::read_to_string(&main_path).unwrap();
    assert!(
        main_source.contains("pragma custom_templates;"),
        "generated main must include custom_templates pragma"
    );
}

#[test]
fn compile_tags() {
    let (ck, _guard) = test_circomkit();
    let out = ck.compile("bounded_add_8").unwrap();
    assert!(out.exists());
    assert!(ck.paths.circuit_r1cs("bounded_add_8").exists());
    assert!(ck.paths.circuit_wasm("bounded_add_8").exists());

    // Verify the generated main file uses circom 2.2.0 (from per-circuit override)
    let main_path = ck.paths.circuit_main("bounded_add_8");
    let main_source = std::fs::read_to_string(&main_path).unwrap();
    assert!(
        main_source.contains("pragma circom 2.2.0;"),
        "generated main must use overridden circom version for tags support"
    );
}

#[test]
fn recompiles_when_forced() {
    // Hold the shared lock + pin CWD so this doesn't race other tests writing
    // the same `tests/build/multiplier_3` directory.
    let _guard = test_lock();
    let mut config =
        CircomkitConfig::from_file(workspace_root().join("tests/circomkit.json")).unwrap();
    config.compiler.recompile = true;
    let ck = Circomkit::new(config).unwrap();

    // First compile
    ck.compile("multiplier_3").unwrap();
    let r1cs_path = ck.paths.circuit_r1cs("multiplier_3");
    let mtime_after_first = r1cs_path.metadata().unwrap().modified().unwrap();

    // Sleep so mtime will differ if recompiled
    std::thread::sleep(std::time::Duration::from_millis(1100));

    // Second compile with recompile=true should rewrite artifacts
    ck.compile("multiplier_3").unwrap();
    let mtime_after_second = r1cs_path.metadata().unwrap().modified().unwrap();

    assert!(
        mtime_after_second > mtime_after_first,
        "r1cs should be rewritten when recompile=true"
    );
}
