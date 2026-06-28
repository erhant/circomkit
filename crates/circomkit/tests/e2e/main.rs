//! End-to-end integration tests for Circomkit.
//!
//! These tests exercise the full pipeline: compilation, witness calculation,
//! proof generation, and verification.
//!
//! Requires `circom` and `snarkjs` to be installed and on PATH.

mod common;

mod compile;
mod config;
mod prove;
mod witness;
