# Testing

Circomkit ships tester utilities that reduce boilerplate so you can focus on inputs and outputs. Signals are built with the `signals!` macro.

## Witness Tester

`WitnessTester` computes witnesses via the WASM calculator and offers assertions:

- `expect_pass(input)` — constraints and assertions pass for the input.
- `expect_pass_with(input, output)` — additionally checks that outputs match.
- `expect_fail(input)` — witness computation must fail (rejection cases).
- `expect_constraint_count(n, exact)` — guard against accidental blowups.
- `compute(input, &["out"])` — extract named output signals.

```rust
use circomkit::{Circomkit, signals};

let ck = Circomkit::from_file("circomkit.json")?;
let config = ck.config.circuits["multiplier_3"].clone();
let tester = ck.witness_tester("multiplier_3", config)?;

// passes on correct input & output
tester.expect_pass_with(
    &signals!{ "in" => vec![2_i64, 4, 10] },
    &signals!{ "out" => 80_i64 },
)?;

// fails on bad input (Multiplier rejects inputs containing 1)
tester.expect_fail(&signals!{ "in" => vec![1_i64, 4, 10] })?;

// exactly 15 constraints
tester.expect_constraint_count(15, true)?;
```

## Testing soundness

Correctness (honest inputs give the right output) is not the same as
**soundness** (a malicious prover _cannot_ satisfy the circuit with a wrong
value). To test soundness, compute a witness, tamper with an internal/output
signal, and assert the constraints now fail:

```rust
use std::collections::HashMap;

let witness = tester.calculate_witness(&input)?;
let mut overrides = HashMap::new();
overrides.insert("main.out".to_string(), 1234.into());
let bad = tester.edit_witness(&witness, &overrides)?;
// assert `bad` no longer satisfies the constraints — otherwise the
// circuit is under-constrained.
```

If a tampered witness still satisfies the circuit, it is under-constrained —
audit every `<--` (see [Learn Circom](./learn-circom.md)).

## Proof Tester

`ProofTester` generates and verifies a proof end-to-end using the WASM file,
proving key, and verification key. Create the setup artifacts first:

```rust
use circomkit::Protocol;

let ck = Circomkit::from_file("circomkit.json")?;
ck.instantiate("multiplier_3")?;
ck.setup("multiplier_3", None)?;      // auto-downloads PTAU for bn128
let tester = ck.proof_tester("multiplier_3", Protocol::Groth16)?;
```
