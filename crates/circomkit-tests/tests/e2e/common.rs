//! Shared test helpers for e2e integration tests.
//!
//! Requires `circom` and `snarkjs` to be installed and on PATH.

use std::path::PathBuf;
use std::sync::{Mutex, Once};

use circomkit::Circomkit;

/// Root of the workspace (two levels up from this crate's manifest dir).
pub fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// PTAU file used by the tests (supports up to 2^8 = 256 constraints).
pub const TEST_PTAU: &str = "powersOfTau28_hez_final_08.ptau";

static ENSURE_PTAU: Once = Once::new();

/// Global lock to serialize tests that share filesystem state (CWD, build dir).
static TEST_LOCK: Mutex<()> = Mutex::new(());

/// Download the test PTAU file if it doesn't exist.
fn ensure_ptau() {
    ENSURE_PTAU.call_once(|| {
        let root = workspace_root();
        let ptau_dir = root.join("tests/ptau");
        let ptau_path = ptau_dir.join(TEST_PTAU);
        if !ptau_path.exists() {
            circomkit::core::utils::download_ptau(TEST_PTAU, &ptau_dir)
                .expect("failed to download test PTAU");
        }
    });
}

/// Load Circomkit from the test config.
///
/// Sets CWD to the workspace root so relative paths in the config resolve correctly.
/// Downloads the PTAU file if it doesn't exist.
///
/// Returns the Circomkit instance AND the lock guard — hold onto the guard
/// for the duration of your test to prevent concurrent filesystem access.
pub fn test_circomkit() -> (Circomkit, std::sync::MutexGuard<'static, ()>) {
    let guard = test_lock();
    let config_path = workspace_root().join("tests/circomkit.json");
    let ck = Circomkit::from_file(&config_path).expect("failed to load test config");
    (ck, guard)
}

/// Acquire the shared test lock and pin CWD to the workspace root, returning the
/// guard. Use this (instead of [`test_circomkit`]) when a test needs a custom
/// config but must still serialize with the rest of the suite — otherwise it
/// races other tests on the shared `tests/build` directory.
pub fn test_lock() -> std::sync::MutexGuard<'static, ()> {
    let guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    std::env::set_current_dir(workspace_root()).expect("failed to set CWD to workspace root");
    ensure_ptau();
    guard
}
