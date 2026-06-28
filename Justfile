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

# Format, lint, and test — the pre-commit gate
check: fmt lint test

# Same as `check` but with native backends enabled
check-all: fmt lint-all test-all
