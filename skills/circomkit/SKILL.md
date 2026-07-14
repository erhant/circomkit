---
name: circomkit
description: >-
  Write, compile, test, and prove Circom zero-knowledge circuits using Circomkit.
  Use this skill whenever the user is working with Circom (`.circom` files, ZK
  circuits, arithmetic circuits, Groth16/PLONK proofs, circomlib, snarkjs) or
  mentions Circomkit — including writing a new circuit, debugging a constraint
  error, setting up a project, computing a witness, generating or verifying a
  proof, or exporting a Solidity verifier. Trigger even when the user doesn't
  say "Circomkit" by name but is clearly building or testing a Circom circuit.
---

# Circomkit — Circom circuit development

Circom is a hardware description language for arithmetic circuits used to build
zero-knowledge proofs. Circomkit is an opinionated toolkit that hides the
snarkjs/circom plumbing behind a single `circomkit.json` config and a CLI, so
you can focus on the circuit itself.

This skill covers both halves: **writing correct Circom** (where most mistakes
happen) and **driving Circomkit** (the compile→prove→verify lifecycle).

## When you're asked to build a circuit

Follow this path. Don't skip the constraint-correctness thinking — a circuit
that "compiles and runs" can still be unsound (see Soundness below).

1. Scaffold or read `circomkit.json` (see `references/circomkit-reference.md`).
2. Write the template under `circuits/` (see the authoring rules below).
3. Register the circuit in `circomkit.json` under `circuits`.
4. Provide an input at `inputs/<circuit>/<input>.json`.
5. Run the lifecycle: `compile → setup → witness → prove → verify`.
6. Write a test with `WitnessTester` to lock in behavior (see Testing).

## Circom authoring rules (read this before writing any circuit)

These are the rules that separate working, sound circuits from subtly broken
ones. Internalize them.

**Signals are the wires.** `signal input x;` (private by default),
`signal output y;` (always public), and plain `signal t;` (intermediate). A
signal is assigned exactly once and is then immutable. Signals hold field
elements modulo the curve prime (bn128 by default) — all arithmetic wraps mod
p, so there are no "negative" or "overflowing" numbers in the usual sense.

**Constraints must be quadratic.** Every constraint may contain at most one
multiplication of signals: `a * b === c` is fine, but `a * b * c === d` is
**not** — the compiler rejects it ("Non quadratic constraints are not
allowed"). Split higher-degree relations across intermediate signals:

```circom
signal ab;
ab <== a * b;      // degree 2
out <== ab * c;    // degree 2 again
```

**Know the three operators — this is the #1 source of bugs.**

- `<==` assigns a signal **and** adds the equivalent constraint. Use this by
  default for outputs and intermediates.
- `<--` assigns a signal **without** constraining it. It's an escape hatch for
  computations the constraint system can't express directly (division,
  comparisons, bit extraction). A `<--` **must** be backed by `===` constraints
  that pin the value down. An unconstrained `<--` is the classic soundness
  hole: a malicious prover can put any value there.
- `===` adds a constraint with no assignment.

Canonical example — `IsZero` needs an inverse it can't compute in-circuit, so it
uses `<--` then constrains the result:

```circom
template IsZero() {
    signal input in;
    signal output out;
    signal inv;
    inv <-- in != 0 ? (1 / in) : 0;   // hint, unconstrained
    out <== -in * inv + 1;            // constrains out
    in * out === 0;                   // ties the hint down: sound
}
```

**`var` is compile-time, `signal` is the circuit.** `var` values (and `=`) exist
only during compilation — use them for loop counters and computing constants.
They never appear in constraints. `for`/`while` loops must have bounds known at
compile time; they *unroll* to generate constraints, they don't run at proving
time.

**Reuse circomlib; don't reinvent.** Comparisons, bit decomposition, hashing,
and muxes are subtle to make sound. Prefer `include`-ing circomlib
(`Num2Bits`, `IsZero`, `IsEqual`, `LessThan`, `Poseidon`, `Mux1`, …) over
hand-rolling. Comparisons in particular require bit decomposition because the
field has no native ordering.

**The main component.** A circuit's entry point is
`component main {public [a, b]} = Template(params);`. Inputs are private unless
listed in `public`; outputs are always public. Circomkit generates this file
for you from `circomkit.json`, so you usually just write the template.

For the full language reference (tags, custom templates, anonymous components,
buses, signal arrays, common patterns), read
`references/circom-language.md`. For a catalog of reusable circuit patterns
(comparators, bit ops, membership, Merkle proofs) read
`references/circuit-patterns.md`.

## Soundness — the thing that actually matters

A proof only means something if the circuit *constrains* what it claims. Two
failure modes to actively check for:

- **Under-constraining:** every `<--` and every output must be forced to its
  intended value by `===`/`<==` constraints. If a prover could choose a
  different value and still satisfy the constraints, the circuit is broken even
  though tests with honest inputs pass. Test this with `WitnessTester`'s
  tamper-the-witness flow (see Testing).
- **Range / overflow assumptions:** field elements wrap mod p. If your logic
  assumes a value fits in N bits, add a `Num2Bits(N)` (or `LessThan`) range
  check — don't assume it.

## Driving Circomkit (CLI lifecycle)

Circomkit reads `./circomkit.json` and abstracts all paths. The core loop:

```sh
circomkit compile <circuit>      # circom → r1cs, wasm, sym
circomkit setup <circuit>        # trusted setup (auto-downloads PTAU for bn128)
circomkit witness <circuit> <input>
circomkit prove <circuit> <input>
circomkit verify <circuit> <input>
```

Other useful commands: `info` (wires/constraints/prime), `instantiate` (main
component only), `contract` (Solidity verifier), `calldata`, `vkey`, `list`,
`config`, and `doctor` (checks that `circom`/`snarkjs` are installed and reports
memory / max usable PTAU). Inputs live at `inputs/<circuit>/<input>.json` as a
JSON object of signal name → value (numbers or decimal strings; arrays for
signal arrays). Full config schema and every command are in
`references/circomkit-reference.md`.

`circom` and `snarkjs` must be on PATH. If something fails at the tool level,
run `circomkit doctor` first.

## Testing

Circomkit's `WitnessTester` is the fast way to check a circuit without a full
proof. Key assertions:

- `expect_pass(input, Some(output))` — inputs satisfy constraints and outputs
  match.
- `expect_fail(input)` — inputs must *not* satisfy the circuit (use for
  rejection cases and `assert` violations).
- `expect_constraint_count(n, exact)` — guard against accidental blowups.
- `compute(input, &["out"])` — read named output signals.

To test **soundness** (not just correctness), compute a witness, tamper with an
internal/output signal, and assert the constraints now fail. If they don't, the
circuit is under-constrained. See `references/circomkit-reference.md` for the
testing API in both Rust and the Node/TS binding.

## Debugging common errors

- **"Non quadratic constraints are not allowed"** — a constraint has degree > 2.
  Introduce intermediate signals to split the multiplication.
- **"Signal not found" / template not found on compile** — the `file`/`template`
  in `circomkit.json` doesn't match the `.circom`, or an `include` path is wrong.
- **Witness passes but proof is meaningless** — under-constrained circuit; audit
  every `<--`. This won't show up as an error; only soundness testing catches it.
- **`assert` failed at witness time** — an input violated an in-circuit
  `assert()`; that's a runtime (not constraint) check.
- **PTAU / setup errors** — for non-`bn128` primes you must supply PTAU
  yourself; `bn128` auto-downloads. Big circuits may exceed available memory —
  check `circomkit doctor`.
