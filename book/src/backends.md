# Backends

Circomkit separates two pluggable concerns: **proving** (setup + prove) and
**witness calculation**.

## Proving backends

Set with `prover.backend` (or the CLI `--backend` flag). A capability matrix is
the single source of truth for which `(backend, protocol, curve)` combinations
are valid; unsupported combinations error early.

| Backend       | Curves        | Protocols              | Notes |
|---------------|---------------|------------------------|-------|
| `snarkjs`     | all 7 primes  | groth16, plonk, fflonk | **default**; also does setup / vkey / contract / verify |
| `arkworks`    | bn254         | groth16                | native Rust; loads a snarkjs `.zkey`, emits a snarkjs-format proof |
| `lambdaworks` | bls12381      | groth16                | native Rust; trusted setup on the fly, reads binary or JSON R1CS |

The native backends are gated behind Cargo features and produce the witness
themselves, then prove:

```sh
cargo build --features "prove-arkworks,prove-lambdaworks"
circomkit prove my_circuit my_input --backend arkworks
```

Even with a native backend selected, `setup`, `vkey`, `contract`, and `verify`
still route through snarkjs.

## Witness backends

Set with `witness.calculator`:

| Calculator | Notes |
|------------|-------|
| `wasm`     | **default**; runs circom's `.wasm` via `wasmtime`. Works everywhere. |
| `c`        | native binary from `circom --c` — significantly faster on large circuits and 64-bit (no wasm 4 GB memory cap). |

The `c` backend builds a native witness binary during `compile` (via `make` in
circom's generated `_cpp` directory). It requires `nasm` and a C toolchain, and
**only builds on x86-64** — circom's C generator emits x86 assembly, so on
Apple Silicon / arm64 you'll get a clear error and should use `wasm` there.

## Choosing

- Prototyping, any curve/protocol → **snarkjs + wasm** (the defaults).
- Large circuits, native speed → the **`c`** witness calculator (x86-64), and/or
  a native proving backend.
- Pure-Rust proving without snarkjs at prove time → **arkworks** (bn254) or
  **lambdaworks** (bls12381).
