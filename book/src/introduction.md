# Introduction

**Circomkit** is a simple-to-use and opinionated toolkit for developing and
testing [Circom](https://docs.circom.io) zero-knowledge circuits. It hides the
`circom`/`snarkjs` plumbing behind a single `circomkit.json` config and a CLI,
so you can focus on the circuit itself.

It is delivered as a modular Rust workspace: a **CLI tool**, a **library**, and
**testing utilities**, with native proving backends and multi-curve support.

- Simple CLI that abstracts all paths behind one config.
- Testing utilities to check circuit computations and soundness with minimal
  boilerplate.
- All protocols: `groth16`, `plonk`, and `fflonk` (via snarkjs).
- Native Rust proving backends: **Arkworks** (Groth16 / BN254) and
  **Lambdaworks** (Groth16 / BLS12-381).
- Automatic phase-1 PTAU download for `bn128`.
- Solidity verifier + calldata export, and JSON exports for R1CS.
- A Node.js / Bun package (via napi-rs) exposing the same toolkit.

> This is a Rust rewrite of the original TypeScript Circomkit. Node.js
> (napi-rs) bindings are shipped; the `Circomkit` struct is intentionally
> FFI-friendly.

## Who this is for

If you are writing Circom circuits and want a repeatable compile → setup →
prove → verify workflow with real tests, Circomkit is for you. It does not teach
you Circom — for that, see [Learn Circom](./learn-circom.md).

## Where to go next

- New here? Start with [Getting Started](./getting-started.md).
- Want the config knobs? See [Configuration](./configuration.md).
- Living on the command line? See the [CLI Reference](./cli.md).
- Embedding Circomkit? See [Rust Library](./library.md) or
  [Node.js & Bun](./bindings.md).
