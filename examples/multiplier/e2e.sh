#!/usr/bin/env bash
#
# End-to-end walkthrough of the Circomkit CLI against the multiplier example.
# Compiles a circuit, runs a trusted setup, computes a witness, proves, and verifies.
#
# Requires `circom` and `snarkjs` on your PATH.
# Run from anywhere:  ./examples/multiplier/e2e.sh
#
set -euo pipefail

# Resolve paths so the script works from any working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CIRCUIT="multiplier_3"
INPUT="default"

# --- helpers ---------------------------------------------------------------

step() {
  echo
  echo "=================================================================="
  echo ">> $1"
  echo "=================================================================="
}

# --- build the CLI ---------------------------------------------------------

step "Building the circomkit CLI"
cargo build -p circomkit-cli --manifest-path "$REPO_ROOT/Cargo.toml"
BIN="$REPO_ROOT/target/debug/circomkit"

# Run every command with the example dir as the working directory so the
# relative paths in circomkit.json (./circuits, ./build, ...) resolve here.
cd "$SCRIPT_DIR"

# --- the walkthrough -------------------------------------------------------

step "Effective configuration"
"$BIN" config

step "Configured circuits"
"$BIN" list

step "Compiling '$CIRCUIT'"
"$BIN" compile "$CIRCUIT"

step "Circuit info (wires, constraints, I/O, prime)"
"$BIN" info "$CIRCUIT"

step "Trusted setup (auto-downloads PTAU for bn128)"
"$BIN" setup "$CIRCUIT"

step "Exporting the verification key"
"$BIN" vkey "$CIRCUIT"

step "Computing the witness for input '$INPUT'"
"$BIN" witness "$CIRCUIT" "$INPUT"

step "Generating a proof for input '$INPUT'"
"$BIN" prove "$CIRCUIT" "$INPUT"

step "Verifying the proof"
"$BIN" verify "$CIRCUIT" "$INPUT"

step "Exporting a Solidity verifier contract"
"$BIN" contract "$CIRCUIT"

step "Exporting Solidity calldata"
"$BIN" calldata "$CIRCUIT" "$INPUT" --pretty

echo
echo "Done! Artifacts are under $SCRIPT_DIR/build/$CIRCUIT"
