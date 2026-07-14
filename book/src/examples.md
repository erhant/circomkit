# Examples

The repository ships a self-contained example under `examples/multiplier/` — the
`Multiplier(3)` circuit demonstrated three ways, all driving the same
`circomkit.json`, circuit, and input.

## CLI

```sh
./examples/multiplier/e2e.sh
```

A shell walkthrough that builds the CLI and runs each command
(`config`, `list`, `compile`, `info`, `setup`, `witness`, `prove`, `verify`,
`contract`, `calldata`) end-to-end.

## Rust

```sh
cargo run -p circomkit --example multiplier
```

Uses the `circomkit` crate directly — see
`crates/circomkit/examples/multiplier.rs`.

## TypeScript (Node & Bun)

First build the native addon once:

```sh
cd bindings/napi && bun install && bun run build
```

Then run from the `ts/` folder:

```sh
cd examples/multiplier/ts
bun install
bun run start          # Bun
bun run start:node     # Node (23.6+)
```

Uses `import { Circomkit } from "circomkit"` — see
`examples/multiplier/ts/index.ts`. The `circomkit` dependency is linked locally
via `file:`.

## More circuits

For a wide catalog of worked circuits (comparators, bits, hashing, Merkle trees,
Sudoku, and more) with explanations, see
[circom101](https://github.com/erhant/circom101) — the companion learning book.
