# Project Layout

Circomkit is a Cargo workspace of focused crates, plus bindings. Useful if you
want to contribute or embed a specific piece.

```ml
crates/
├── circomkit-core       — config, types, pathing, R1CS/witness/sym parsers,
│                          compilation, PTAU, calldata
├── circomkit-parser     — lightweight Circom source parser (interfaces)
├── circomkit-codegen    — codegen: main components, tag wrappers, input scaffolding
├── circomkit-witness    — WitnessCalculator trait + WASM (wasmtime) & C backends
├── circomkit-prove      — ProvingBackend trait + snarkjs / arkworks / lambdaworks
├── circomkit-test       — WitnessTester, ProofTester
├── circomkit            — umbrella: the Circomkit orchestrator + re-exports
└── circomkit-cli        — the `circomkit` binary (clap)

bindings/
└── napi                 — Node.js / Bun package (circomkit on npm)
```

## Design notes

- **snarkjs via subprocess** for proving/setup/verify (all protocols, all 7
  primes).
- **wasmtime** for WASM witness calculation; a native C backend for large
  circuits.
- **JSON config** (`circomkit.json`) with a generated JSON schema.
- **Per-circuit config overrides** that merge on top of global settings.
- **mtime-based compilation skipping** — recompiles only when sources change.
- **Dynamic dispatch** for witness/proving backends (runtime selection).
- **Synchronous everywhere** — crypto is CPU-bound, subprocess is blocking.
- **FFI-friendly** `Circomkit` struct (no generics, owned returns) — this is
  what makes the [Node.js bindings](./bindings.md) a thin wrapper.

## Contributing

Common tasks are wrapped in a `Justfile`:

```sh
just            # list recipes
just fmt        # cargo fmt --all
just lint       # cargo clippy --workspace --all-targets
just test       # cargo test --workspace
just check      # fmt + lint + test
just schema     # regenerate schema.json from the config types
```

Integration tests require `circom` and `snarkjs` on your `PATH`.
