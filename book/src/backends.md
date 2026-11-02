# Backends

Circomkit separates two pluggable concerns:

- **proving** (setup + prove)
- **witness calculation**.

## Proving backends

Set with `prover.backend` (or the CLI `--backend` flag). A capability matrix is
the single source of truth for which `(backend, protocol, curve)` combinations
are valid; unsupported combinations error early.

| Backend    | Curves       | Protocols              | Notes                                                              |
| ---------- | ------------ | ---------------------- | ------------------------------------------------------------------ |
| `snarkjs`  | all 7 primes | groth16, plonk, fflonk | **default**; also does setup / vkey / contract / json              |
| `arkworks` | bn254        | groth16                | native Rust; loads a snarkjs `.zkey`, emits a snarkjs-format proof |

The native backend is gated behind the `prove-arkworks` Cargo feature and
produces the witness itself, then proves:

```sh
cargo build --features prove-arkworks
circomkit prove my_circuit my_input --backend arkworks
```

`verify` follows the configured `prover.backend`: arkworks verifies natively
from the snarkjs JSON (vkey / proof / public signals), snarkjs via its CLI.

> [!NOTE]
>
> Even with arkworks selected, `setup`, `vkey`, `contract`, and `json` route through `snarkjs`.

> [!NOTE]
>
> The native backend is Rust-only. The npm addon ([Bindings](./bindings.md)) ships with `snarkjs` alone, so its `ProvingBackend` type has just that one variant.

## Witness backends

Set with `witness.calculator`:

| Calculator | Notes                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| `wasm`     | **default**; runs circom's `.wasm` via `wasmtime`. Works everywhere.      |
| `c`        | native binary from `circom --c` — significantly faster on large circuits. |

> [!NOTE]
>
> The `c` backend builds a native witness binary during `compile` (via `make` in circom's generated `_cpp` directory). It requires `nasm` and a C toolchain, and **only builds on x86-64** — circom's C generator emits x86 assembly, so on Apple Silicon / arm64 you'll get a clear error and should use `wasm` there.
>
> There is an arm64-compatible [fork online](https://github.com/bajpai244/circom_c_witness_generator), but Circomkit does not support it.

## Choosing

Based on your needs, we suggest the following:

- Prototyping over any curve/protocol: Use **snarkjs + wasm** (the defaults).
- Large circuits, native speed: use the **`c`** witness calculator (x86-64), and/or a native proving backend.
- Pure-Rust proving & verification without snarkjs at prove/verify time: use **arkworks** over `bn254`.
