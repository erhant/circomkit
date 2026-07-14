## Run `just` to see recipes.

# List available recipes
default:
    @just --list

# Format all crates
fmt:
    cargo fmt --all

# Check formatting without modifying files (CI-friendly)
fmt-check:
    cargo fmt --all --check

# Lint with clippy across the workspace
lint:
    cargo clippy --workspace --all-targets

# Lint including the native proving backends
lint-all:
    cargo clippy --workspace --all-targets --features "prove-arkworks,prove-lambdaworks"

# Run the test suite (e2e needs `circom` + `snarkjs` on PATH)
test:
    cargo test --workspace

# Run tests including the native proving backends
test-all:
    cargo test --workspace --features "prove-arkworks,prove-lambdaworks"

# Regenerate schema.json from the config types
schema:
    cargo test -p circomkit-core generate_schema -- --ignored

# Fail if schema.json is out of date with the config types (CI gate)
schema-check:
    #!/usr/bin/env bash
    set -euo pipefail
    tmp="$(mktemp)"
    trap 'rm -f "$tmp"' EXIT
    CIRCOMKIT_SCHEMA_OUT="$tmp" cargo test -p circomkit-core generate_schema -- --ignored >/dev/null
    if ! diff -u schema.json "$tmp"; then
        echo "error: schema.json is out of date — run 'just schema' and commit" >&2
        exit 1
    fi

# Format, lint, and test — the pre-commit gate
check: fmt lint test

# Same as `check` but with native backends enabled
check-all: fmt lint-all test-all
