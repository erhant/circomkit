---
name: circomkit
description: >-
  Use Circomkit to compile, test, prove, and verify Circom circuits. Trigger
  whenever the user works with a `circomkit.json`, the `circomkit` CLI, or the
  Circomkit library (Rust or the `circomkit` npm package) — e.g. compiling a
  circuit, running a trusted setup, computing a witness, generating/verifying a
  proof, exporting a Solidity verifier or calldata, choosing a proving/witness
  backend, or writing circuit tests with WitnessTester/ProofTester. This is the
  *toolkit* skill; for writing the Circom circuits themselves, use the `circom`
  skill / the circom101 book.
---

# Circomkit — the toolkit

Circomkit hides the `circom`/`snarkjs` plumbing behind a single `circomkit.json`
and a CLI, so a project has one repeatable lifecycle. This skill covers *using
Circomkit*; it assumes the circuit is (or will be) written elsewhere — for the
Circom language itself, defer to the circom101 book / `circom` skill.

`circom` and `snarkjs` must be on `PATH`. Run `circomkit doctor` to verify the
environment (tool versions, OS, memory, and the largest usable PTAU).

## The lifecycle

```sh
circomkit compile <circuit>          # circom → r1cs, wasm, sym
circomkit setup   <circuit>          # trusted setup (auto-downloads PTAU for bn128)
circomkit witness <circuit> <input>
circomkit prove   <circuit> <input>  # [--backend snarkjs|arkworks|lambdaworks]
circomkit verify  <circuit> <input>
```

Also: `info` (wires/constraints/prime), `instantiate`, `contract` (Solidity
verifier), `calldata`, `vkey`, `ptau`, `clear`, `list`, `config`, `doctor`.
`compile` takes a **regex** over circuit names.

## circomkit.json

One config drives everything. Register each circuit under `circuits`, keyed by
instance name:

```json
{
  "$schema": "./schema.json",
  "prover": { "protocol": "groth16", "backend": "snarkjs" },
  "compiler": { "prime": "bn128", "srcDir": "./circuits", "outDir": "./build" },
  "circuits": {
    "multiplier_3": { "file": "multiplier", "template": "Multiplier", "params": [3] }
  }
}
```

Inputs live at `inputs/<circuit>/<input>.json` (a JSON object of signal → value;
decimal strings for large numbers, arrays for signal arrays). The full config
schema, every CLI flag, backends, and the library APIs are in
`references/reference.md` — read it when you need specifics.

## Testing

Prefer `WitnessTester` to check a circuit fast (no full proof):

- `expect_pass(input)` — constraints and assertions hold for the input.
- `expect_pass_with(input, output)` — constraints hold and outputs match.
- `expect_fail(input)` — inputs must be rejected.
- `expect_constraint_count(n, exact)` — guard against blowups.

Critically, test **soundness**, not just correctness: compute a witness, tamper
with an internal/output signal (`edit_witness`), and assert the constraints now
fail. If a tampered witness still passes, the circuit is under-constrained. The
exact API (Rust and the Node `circomkit` package) is in `references/reference.md`.

## Backends

- **Proving** (`prover.backend`): `snarkjs` (default, all protocols/primes),
  `arkworks` (groth16/bn254, Cargo feature), `lambdaworks` (groth16/bls12381,
  Cargo feature).
- **Witness** (`witness.calculator`): `wasm` (default, everywhere) or `c`
  (native, faster on large circuits, **x86-64 Linux only** — needs nasm/gmp).

See `references/reference.md` for the capability matrix and details.
