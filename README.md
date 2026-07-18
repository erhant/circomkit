<p align="center">
  <h1 align="center">
    Circomkit
  </h1>
  <p align="center"><i>A simple-to-use & opinionated circuit development & testing toolkit — in Rust.</i></p>
</p>

<p align="center">
    <a href="https://opensource.org/licenses/MIT" target="_blank">
        <img src="https://img.shields.io/badge/license-MIT-blue.svg">
    </a>
    <a href="https://www.rust-lang.org" target="_blank">
        <img alt="Rust" src="https://img.shields.io/badge/rust-edition%202024-orange.svg?logo=rust">
    </a>
</p>

This is a Rust rewrite of [Circomkit](https://github.com/erhant/circomkit) (originally TypeScript), delivered as a modular workspace: a **CLI tool**, a **library**, and **testing utilities**. It keeps the opinionated, path-abstracting design of the original while adding native Rust proving backends and multi-curve support.

- [x] Simple CLI, abstracting away all paths behind a single config.
- [x] Testing utilities to check circuit computations & soundness errors, with minimal boilerplate.
- [x] Supports all protocols: `groth16`, `plonk`, and `fflonk` (via snarkjs).
- [x] Native Rust proving backends: **Arkworks** (Groth16 / BN254) and **Lambdaworks** (Groth16 / BLS12-381).
- [x] Automatically downloads phase-1 PTAU when using `bn128`.
- [x] Exports a Solidity verifier contract and its calldata, or JSON exports for R1CS.

> [!NOTE]
>
> This is a Rust rewrite of the original TypeScript Circomkit. A Node.js / Bun package (via napi-rs) is available; the `Circomkit` struct is intentionally FFI-friendly (no generics, owned return types).

## Documentation

The **[Circomkit book](./book/)** is the full guide — getting started, configuration, the CLI, backends, testing, and the Rust / Node.js APIs. Build it locally with [`mdbook`](https://rust-lang.github.io/mdBook/): `mdbook serve book`.

Learning Circom itself? See the companion book **[circom101](https://github.com/erhant/circom101)**.

## Requirements

Circomkit shells out to external tools for compilation and (by default) proving:

- [`circom`](https://docs.circom.io/getting-started/installation/) (v2.2.x) — circuit compiler.
- [`snarkjs`](https://github.com/iden3/snarkjs) (v0.7.x, installed globally via npm) — used for the default proving/setup/verify pipeline (Groth16, PLONK, FFLONK across all 7 primes).

The native Arkworks / Lambdaworks backends do their own proving in-process and don't require snarkjs to _prove_, but setup / vkey / contract / verify still route through snarkjs.

## Installation

Build from source with Cargo (edition 2024):

```sh
cargo build --release        # binary at target/release/circomkit
cargo run -p circomkit-cli   # run the CLI directly
```

To use Circomkit as a library, add the umbrella crate as a dependency:

```toml
[dependencies]
circomkit = { git = "https://github.com/erhant/circomkit" }
```

## Usage

You can see available commands with:

```sh
circomkit --help
```

By default the CLI reads `./circomkit.json`; override it with the global `--config` flag.

### Command Line Interface

Actions that require a circuit name can be called as follows:

```sh
# Compile circuit(s) — the argument is a regex, so "multiplier.*" matches many
circomkit compile <pattern>

# Create the main component file
circomkit instantiate <circuit>

# Print circuit info (wires, constraints, public/private I/O, prime, ...)
circomkit info <circuit>

# Create a Solidity verifier contract
circomkit contract <circuit>

# Remove build artifacts for a circuit
circomkit clear <circuit>

# Circuit-specific trusted setup (auto-downloads PTAU if --ptau is omitted)
circomkit setup <circuit> [--ptau <path>]

# Export the verification key
circomkit vkey <circuit>

# Automatically download PTAU (for BN128)
circomkit ptau <circuit>
```

> [!NOTE]
>
> `setup` optionally takes a PTAU path. If omitted, Circomkit decides which PTAU to use based on the constraint count and downloads it for you. This only works for the `bn128` prime and has an upper-limit of $2^{28}$ constraints.

Actions that generate a witness, a proof, or verify a proof need JSON inputs for the signal values. Input files live under the `inputs` folder, in a directory named after the circuit. For example, an input named `foo` for a circuit named `bar` is at `inputs/bar/foo.json`.

> [!TIP]
>
> For circuits with a single input, you can skip the subdirectory and use the flat `inputs/{circuit}.json` layout instead. When `inputs/{circuit}/{input}.json` is missing, Circomkit falls back to `inputs/{circuit}.json`.

```sh
# Compute a witness
circomkit witness <circuit> <input>

# Generate a proof (optionally overriding the configured backend)
circomkit prove <circuit> <input> [--backend <snarkjs|arkworks|lambdaworks>]

# Verify a proof
circomkit verify <circuit> <input>

# Export Solidity calldata to the console
circomkit calldata <circuit> <input> [--pretty]

# Export R1CS metadata as JSON
circomkit json r1cs <circuit>
```

You can also inspect configured circuits and the effective configuration:

```sh
# List configured circuits
circomkit list

# Print the effective (resolved) configuration
circomkit config

# Diagnose your environment: circom/snarkjs versions, OS, memory, and the
# largest PTAU power your machine can likely handle (add --json for machine output)
circomkit doctor
```

### Circomkit Configuration

Everything is driven by a single `circomkit.json`, following the v0.4 unified-config style with nested sections. You can print the active configuration with `circomkit config`, and a JSON schema is available (`schema.json`) for editor autocompletion.

```json
{
  "$schema": "./schema.json",
  "prover": {
    "protocol": "groth16",
    "backend": "snarkjs",
    "ptauDir": "./ptau",
    "inputDir": "./inputs"
  },
  "compiler": {
    "prime": "bn128",
    "srcDir": "./circuits",
    "outDir": "./build",
    "optimization": 1
  },
  "witness": { "calculator": "wasm" },
  "logLevel": "info",
  "circuits": {
    "multiplier_3": {
      "file": "multiplier",
      "template": "Multiplier",
      "params": [3]
    }
  }
}
```

You can change the `protocol` (`groth16`, `plonk`, `fflonk`), the proving `backend` (`snarkjs`, `arkworks`, `lambdaworks`), and the underlying `prime` (`bn128`, `bls12381`, `goldilocks`, `grumpkin`, `pallas`, `vesta`, `secq256r1`).

> [!NOTE]
>
> Using a prime other than `bn128` makes circuit-specific setup harder, as you must supply the PTAU files yourself; with `bn128` we can use the [Perpetual Powers of Tau](https://github.com/privacy-scaling-explorations/perpetualpowersoftau).

### Circuit Configuration

Each entry under `circuits` uses the circuit name as the key. The value describes the source filename, the template name, its public signals, and its template parameters:

```json
"sudoku_9x9": {
  "file": "sudoku",
  "template": "Sudoku",
  "pubs": ["puzzle"],
  "params": [3]
}
```

> [!TIP]
>
> `pubs` and `params` can be omitted, in which case they default to `[]`. Per-circuit `overrides` merge on top of the global settings (e.g. `"overrides": { "version": "2.2.0" }`).

### Using Circomkit in Code

The `Circomkit` orchestrator exposes the same operations as the CLI. You can load config from a file, or provide circuit configuration and inputs directly.

```rust
use circomkit::{Circomkit, signals};

// Load configuration from circomkit.json (accepts any AsRef<Path>: &str, PathBuf, ...)
let ck = Circomkit::from_file("circomkit.json")?;

// Artifacts output under build/multiplier_3
ck.compile("multiplier_3")?;

// Compute a witness from inline signals
let input = signals! { "in" => vec![3_i64, 5, 7] };
let wtns = ck.witness("multiplier_3", "my_input", Some(&input))?;

// Generate a proof; pass None to fall back to the configured backend
let proof = ck.prove("multiplier_3", "my_input", Some(&input), None)?;

// Verify it
assert!(ck.verify("multiplier_3", "my_input")?);
```

## Writing Tests

Circomkit provides two tester utilities that reduce boilerplate so you can focus on inputs and outputs. Signals are built with the `signals!` macro.

### Witness Tester

`WitnessTester` computes witnesses via the WASM calculator (wasmtime) and offers assertion helpers:

- `expect_pass(input)` — constraints & assertions pass for the input.
- `expect_pass_with(input, output)` — additionally checks that outputs match.
- `expect_fail(input)` — witness computation fails (returns the error message).

```rust
use circomkit::{Circomkit, signals};

let ck = Circomkit::from_file("circomkit.json")?;
let config = ck.config.circuits["multiplier_3"].clone();
let tester = ck.witness_tester("multiplier_3", config)?;

// Passes on correct input & output
let input  = signals! { "in" => vec![2_i64, 4, 10] };
let output = signals! { "out" => 80_i64 };
tester.expect_pass_with(&input, &output)?;

// Fails on bad input
let bad = signals! { "in" => vec![1_i64, 4, 10] };
tester.expect_fail(&bad)?;
```

Check the constraint count with `expect_constraint_count(n, exact)` — `exact = true` asserts equality, otherwise it asserts `actual >= n`:

```rust
tester.expect_constraint_count(15, true)?; // exactly 15 constraints
```

For finer control over outputs, `compute(input, &["out"])` extracts named output signals from the witness:

```rust
let out = tester.compute(&signals! { "in" => vec![2_i64, 3, 5] }, &["out"])?;
assert_eq!(out["out"], circomkit::SignalValue::Single(30.into()));
```

To test for **soundness errors**, compute a witness with `calculate_witness`, tamper with it via `edit_witness` (a map of symbol names to new values), then check that constraints now fail:

```rust
use std::collections::HashMap;

let witness = tester.calculate_witness(&input)?;
let mut overrides = HashMap::new();
overrides.insert("main.out".to_string(), 1234.into());
let bad_witness = tester.edit_witness(&witness, &overrides)?;
// assert that bad_witness no longer satisfies the constraints
```

### Proof Tester

`ProofTester` generates and verifies a proof end-to-end using the WASM file, proving key, and verification key. Create the setup artifacts before constructing the tester:

```rust
use circomkit::Protocol;

let ck = Circomkit::from_file("circomkit.json")?;
ck.instantiate("multiplier_3")?;
ck.setup("multiplier_3", None)?;               // auto-downloads PTAU for bn128
let tester = ck.proof_tester("multiplier_3", Protocol::Groth16)?;
```

## Native Proving Backends

Beyond snarkjs, Circomkit ships two native Rust Groth16 backends, gated behind Cargo features on the umbrella / CLI crates:

| Backend     | Feature flag        | Curve        | Notes                                                    |
| ----------- | ------------------- | ------------ | -------------------------------------------------------- |
| snarkjs     | _(default)_         | all 7 primes | full protocol support (Groth16 / PLONK / FFLONK)         |
| Arkworks    | `prove-arkworks`    | BN254        | loads a snarkjs `.zkey`, produces a snarkjs-format proof |
| Lambdaworks | `prove-lambdaworks` | BLS12-381    | trusted setup on-the-fly, reads binary or JSON R1CS      |

```sh
cargo build --features "prove-arkworks,prove-lambdaworks"
circomkit prove my_circuit my_input --backend arkworks
```

The `circomkit-prove::capabilities` matrix is the single source of truth for which `(backend, protocol, curve)` combinations are valid; unsupported combinations error early (`UnsupportedProtocol` / `UnsupportedCurve` / `BackendNotEnabled`). The `--backend` flag (and the `backend` argument to `Circomkit::prove`) overrides the configured `prover.backend`.

## Workspace Structure

The project is a Cargo workspace of focused crates:

```ml
crates
├── circomkit-core     - "config, types, pathing, R1CS/witness/sym parsers, compile, PTAU, calldata"
├── circomkit-witness  - "WitnessCalculator trait + WASM backend (wasmtime)"
├── circomkit-prove    - "ProvingBackend trait + snarkjs / arkworks / lambdaworks backends"
├── circomkit-test     - "WitnessTester, ProofTester"
├── circomkit          - "umbrella: Circomkit orchestrator + re-exports"
└── circomkit-cli      - "the `circomkit` binary (clap)"
```

## File Structure

Circomkit follows an _opinionated file structure_, abstracting away pathing behind the scenes. All directories can be customized in `circomkit.json`. An example for a Sudoku circuit with a 9x9 main component:

```ml
circomkit
├── circomkit.json - "circomkit configuration"
│
├── circuits - "circuit source code"
│   ├── main - "auto-generated main components"
│   │   └── sudoku_9x9.circom
│   └── sudoku.circom - "circuit template"
│
├── inputs - "circuit inputs"
│   └── sudoku_9x9 - "folder name is the circuit instance name"
│       └── my_solution.json - "file name is the input name"
│
├── ptau - "PTAU files"
│   └── powersOfTau28_hez_final_08.ptau
│
└── build - "build artifacts"
    └── sudoku_9x9 - "folder name is the circuit instance name"
        ├── sudoku_9x9_js - "WASM outputs"
        │   └── sudoku_9x9.wasm
        │
        ├── my_solution - "folder name is the input name"
        │   ├── groth16_proof.json - "proof, per protocol"
        │   ├── public.json
        │   └── witness.wtns
        │
        ├── sudoku_9x9.r1cs
        ├── sudoku_9x9.sym - "symbol file, used by tests"
        │
        ├── groth16_pkey.zkey - "proving key, per protocol"
        ├── groth16_vkey.json - "verification key, per protocol"
        └── groth16_verifier.sol - "verifier contract"
```

## Development

Common tasks are wrapped in a [`Justfile`](./Justfile):

```sh
just            # list recipes
just fmt        # cargo fmt --all
just lint       # cargo clippy --workspace --all-targets
just test       # cargo test --workspace
just check      # fmt + lint + test

# variants that enable the native proving backends
just lint-all
just test-all
just check-all
```

Integration tests require `circom` and `snarkjs` on your `PATH`. Test circuits live under `tests/circuits/` and are configured via `tests/circomkit.json`; end-to-end tests live in the unpublished `circomkit-tests` crate (`crates/circomkit-tests/tests/e2e/`).

### Solidity verifier tests

An optional end-to-end test compiles the snarkjs-exported Groth16 verifier, deploys it into an in-process EVM ([`revm`](https://github.com/bluealloy/revm)), and checks that the calldata circomkit emits makes `verifyProof` return `true` (with a tampered public signal rejected). ABI encoding uses [`alloy`](https://github.com/alloy-rs/alloy).

It is gated behind the `circomkit-tests` crate's `test-solidity` feature (so `revm`/`alloy` aren't compiled by default) and additionally requires the [`solc`](https://docs.soliditylang.org/en/latest/installing-solidity.html) binary on your `PATH` — the test skips with a notice if `solc` is missing.

```sh
cargo test -p circomkit-tests --features test-solidity --test e2e
```

## Acknowledgements

We wholeheartedly thank [BuidlGuidl](https://buidlguidl.com/) & [Austin Griffith](https://twitter.com/austingriffith) for providing Circomkit with an [Ecosystem Impact Grant](https://grants.buidlguidl.com/)!

## License

Licensed under [MIT](./LICENSE).
