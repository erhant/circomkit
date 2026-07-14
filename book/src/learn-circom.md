# Learn Circom

Circomkit is a *toolkit* — it assumes you already know (or are learning) Circom
itself. This page points you to the best resources and gives a one-page
orientation.

## Companion book: circom101

For a structured, example-driven tour of Circom and circuit design — comparators,
bit operations, hashing (Poseidon/MiMC), Merkle trees, Sudoku, and the theory
behind them — read **[circom101](https://github.com/erhant/circom101)**. Every
example there is tested with Circomkit, so the two fit together naturally.

## Other resources

- [Official Circom docs](https://docs.circom.io) — the language reference.
- [circomlib](https://github.com/iden3/circomlib) — the standard library of
  reusable templates (comparators, hashers, muxes, …). Prefer these over
  hand-rolling.

## One-page orientation

A few rules that prevent most beginner mistakes:

- **Signals are wires.** `signal input` (private by default), `signal output`
  (always public), plain `signal` (intermediate). Each is assigned once and is
  immutable. Values are field elements mod the curve prime — arithmetic wraps,
  there is no overflow error and no native ordering.
- **Constraints must be quadratic.** At most one signal×signal multiplication
  per constraint. Split higher degrees with intermediate signals.
- **Know the operators.** `<==` assigns *and* constrains (use by default);
  `<--` assigns *without* constraining (an escape hatch that **must** be pinned
  down by `===`); `===` constrains without assigning. An unconstrained `<--` is
  the classic soundness hole.
- **`var` is compile-time.** Loops and `if` over `var` unroll at compile time to
  generate constraints — they don't run at proving time. To branch on a
  *signal*, use a mux, not `if`.
- **Reuse circomlib** for comparisons, bit decomposition, and hashing — they are
  subtle to make sound.

Correctness (honest inputs → right output) is not soundness (a cheater
*cannot* satisfy the circuit with a wrong value). Use Circomkit's
[soundness testing](./testing.md#testing-soundness) to catch under-constrained
circuits.
