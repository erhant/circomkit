# Circomkit reference

Config schema, project layout, every CLI command, backends, and the testing API. Read the section you need.

## Table of contents

- [Project layout](#project-layout)
- [circomkit.json](#circomkitjson)
- [CLI commands](#cli-commands)
- [Inputs](#inputs)
- [Backends](#backends)
- [Testing (Rust)](#testing-rust)
- [Testing / usage (Node & Bun)](#testing--usage-node--bun)

## Project layout

Circomkit is opinionated about paths; all are configurable but default to:

```
circomkit.json            # config
circuits/                 # your templates
  main/                   # auto-generated main components (do not edit)
inputs/<circuit>/<input>.json
ptau/                     # phase-1 powers of tau
build/<circuit>/          # r1cs, wasm, sym, zkey, vkey, proof, verifier.sol
```

For a circuit with a single input you may use the flat `inputs/<circuit>.json`instead of `inputs/<circuit>/<input>.json`.

## circomkit.json

```json
{
  "$schema": "./schema.json",
  "prover": {
    "protocol": "groth16", // groth16 | plonk | fflonk
    "backend": "snarkjs", // snarkjs | arkworks
    "ptauDir": "./ptau",
    "inputDir": "./inputs"
  },
  "compiler": {
    "prime": "bn128", // bn128 | bls12381 | goldilocks | grumpkin | pallas | vesta | secq256r1
    "srcDir": "./circuits",
    "outDir": "./build",
    "optimization": 1 // PLONK requires >= 1
  },
  "witness": { "calculator": "wasm" }, // wasm | c
  "logLevel": "info",
  "circuits": {
    "multiplier_3": {
      "file": "multiplier", // circuits/multiplier.circom
      "template": "Multiplier", // the template to instantiate
      "params": [3], // template parameters (optional, default [])
      "pubs": ["in"], // public input signals (optional, default [])
      "overrides": { "version": "2.2.0" } // per-circuit config overrides (optional)
    }
  },
  "version": "2.1.0" // default circom pragma version for generated main
}
```

Notes:

- `circom` and `snarkjs` must be installed and on PATH (Circomkit shells out to
  them). `circomkit doctor` verifies this.
- Non-`bn128` primes make trusted setup harder — you must supply PTAU yourself
  (only `bn128` auto-downloads via the Perpetual Powers of Tau, up to 2^28).
- `pubs` lists which _inputs_ are public; outputs are always public.
- Per-circuit `overrides` merge on top of the global sections.
- WASM is always emitted; circom's `--c` output is enabled automatically when
  `witness.calculator` is `c`.
- Tagged inputs: `component main` can't have them, so if the template has tagged
  inputs (e.g. `signal input {maxbits} a;`) Circomkit generates and instantiates
  a `<Template>_circomkit_main` wrapper. `params` are then the template's own
  params followed by one value per distinct tag (first-seen order), e.g.
  `{ "file": "tags", "template": "BoundedAdd", "params": [8] }` →
  `component main = BoundedAdd_circomkit_main(8);`. Needs `"version": "2.2.0"`;
  only templates in the circuit's own file are wrapped.

## CLI commands

The binary reads `./circomkit.json` (override with the global `--config` flag).

```sh
circomkit init [dir]               # scaffold a minimal project (never overwrites)
circomkit doctor [--json]          # check circom/snarkjs and OS
circomkit list                     # list configured circuits
circomkit config                   # print the resolved config

circomkit compile <pattern>        # regex over circuit names; builds r1cs/wasm/sym
circomkit instantiate <circuit>    # generate only the main component file
circomkit info <circuit>           # wires, constraints, I/O counts, prime
circomkit clear <circuit>          # remove build artifacts

circomkit setup <circuit> [--ptau <path>]   # trusted setup (auto-downloads for bn128)
circomkit ptau <circuit>           # download the PTAU for a circuit
circomkit vkey <circuit>           # export the verification key
circomkit contract <circuit>       # export a Solidity verifier

circomkit witness <circuit> <input>
circomkit prove <circuit> <input> [--backend snarkjs|arkworks]
circomkit verify <circuit> <input>  # uses the configured prover.backend
circomkit calldata <circuit> <input> [--pretty]   # Solidity calldata

# export via snarkjs to <artifact>.json (e.g. build/<c>/<c>.r1cs.json); -p also prints
circomkit json r1cs <circuit> [-p|--print]
circomkit json zkey <circuit> [-p]            # groth16 only
circomkit json wtns <circuit> <input> [-p]

circomkit codegen input <circuit> [--save <name>]  # zero-filled input JSON (--save → inputs/<circuit>/<name>.json)
circomkit codegen wrapper <circuit>                # print the tag wrapper for tagged inputs
```

`compile` takes a **regex**, so `circomkit compile ".*"` builds everything and
`circomkit compile "multiplier.*"` builds a subset.

## Inputs

An input file is a JSON object mapping signal names to values. Use decimal
strings for large values (beyond JS safe integers); arrays for signal arrays:

```json
{ "in": [2, 4, 10] }
```

```json
{
  "a": "218882428718392752222464057452572750885483644004160343436982041865758084956",
  "b": 3
}
```

## Backends

Proving (`prover.backend`):

| backend    | curves       | protocols            | notes                                                                   |
| ---------- | ------------ | -------------------- | ----------------------------------------------------------------------- |
| `snarkjs`  | all 7 primes | groth16/plonk/fflonk | default; also does setup/vkey/contract/json                             |
| `arkworks` | bn254        | groth16              | Cargo feature `prove-arkworks`; loads a snarkjs zkey, verifies natively |

`verify` follows `prover.backend`: arkworks verifies in-process from the snarkjs
JSON (vkey/proof/public), snarkjs via its CLI.

Witness (`witness.calculator`):

- `wasm` (default): wasmtime over circom's `.wasm`. Works everywhere.
- `c`: native binary from `circom --c` (faster on large circuits, 64-bit, no
  wasm 4 GB cap). Requires `nasm` + a C toolchain and **only builds on x86-64**
  (circom's C generator emits x86 assembly).

## Testing (Rust)

`WitnessTester` computes witnesses via the wasm calculator and asserts on them:

```rust
use circomkit::{Circomkit, signals};

let ck = Circomkit::from_file("circomkit.json")?;
let config = ck.config.circuits["multiplier_3"].clone();
let tester = ck.witness_tester("multiplier_3", config)?;

// correctness
tester.expect_pass_with(&signals!{ "in" => vec![2_i64, 4, 10] }, &signals!{ "out" => 80_i64 })?;
// rejection
tester.expect_fail(&signals!{ "in" => vec![1_i64, 4, 10] })?;
// guard the constraint count
tester.expect_constraint_count(15, true)?;
// read outputs
let out = tester.compute(&signals!{ "in" => vec![2_i64, 3, 5] }, &["out"])?;
```

Soundness testing — tamper with a witness and assert constraints now fail:

```rust
let witness = tester.calculate_witness(&input)?;
tester.expect_constraint_pass(&witness)?; // A·B = C mod p holds
let mut overrides = std::collections::HashMap::new();
overrides.insert("main.out".to_string(), 1234.into());
let bad = tester.edit_witness(&witness, &overrides)?;
tester.expect_constraint_fail(&bad)?; // passes -> circuit rejects the forgery
```

`ProofTester` runs a full prove+verify end-to-end (needs `setup` first).

Orchestrator helpers: `ck.input(circuit, name, &data)` saves
`inputs/<circuit>/<name>.json`; `ck.json(JsonTarget::{R1cs,Zkey,Wtns}, circuit,
input)` exports JSON next to the artifact; `ck.scaffold_input(circuit)`,
`ck.tag_wrapper(circuit)`, `ck.template_interface(circuit)`.

## Testing / usage (Node & Bun)

The `circomkit` npm package (napi bindings) exposes the lifecycle and typed
testers. Drive it directly:

```ts
import { Circomkit } from "circomkit";

const ck = Circomkit.fromFile("circomkit.json");
ck.compile("multiplier_3");
ck.setup("multiplier_3"); // auto-downloads PTAU for bn128
ck.witness("multiplier_3", "default", { in: [2, 4, 10] });
ck.prove("multiplier_3", "default", { in: [2, 4, 10] });
const ok = ck.verify("multiplier_3", "default"); // boolean
const info = ck.info("multiplier_3"); // { wires, constraints, primeName, ... }
ck.input("multiplier_3", "other", { in: [3, 5, 7] }); // save inputs/multiplier_3/other.json
ck.json("r1cs", "multiplier_3"); // "r1cs" | "zkey" | "wtns" (wtns takes an input name)
ck.scaffoldInput("multiplier_3"); // zero-filled input object
```

Testers: `const t = ck.WitnessTester("multiplier_3")`, then `t.expectPass(...)`,
`t.calculateWitness(...)`, `t.editWitness(w, { "main.out": "1234" })`, and
`t.expectConstraintPass(w)` / `t.expectConstraintFail(w)` to check a witness
against the R1CS constraints.

Inputs and inline config are plain objects (with `bigint` support);
path-returning methods return a string path. The `circomkit` package also ships the CLI as a `bin`.
