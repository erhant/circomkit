//! Unpublished crate that houses circomkit's end-to-end integration tests.
//!
//! There is no library code here — the crate exists so the e2e tests (and their
//! heavy, test-only dependencies like `revm`/`alloy`) live outside the published
//! `circomkit` crate. See `tests/e2e/`.
