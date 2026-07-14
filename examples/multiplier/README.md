# multiplier example

A self-contained Circomkit project — `Multiplier(3)`, which multiplies three
numbers and asserts none of them is 1 — demonstrated **three ways**: the CLI, the
Rust library, and the native npm library (Node & Bun). All three drive the same
`circomkit.json`, circuit, and input, and write artifacts to `./build`.

Each runs the full lifecycle: compile → trusted setup → witness → prove → verify.

## Requirements

`circom` and `snarkjs` must be installed and on your `PATH`.

## CLI

```sh
./e2e.sh
```

A shell walkthrough that builds the `circomkit` CLI and runs each command
(`config`, `list`, `compile`, `info`, `setup`, `witness`, `prove`, `verify`,
`contract`, `calldata`) against this project.

## Rust

```sh
cargo run -p circomkit --example multiplier
```

Uses the `circomkit` crate directly (see
[`crates/circomkit/examples/multiplier.rs`](../../crates/circomkit/examples/multiplier.rs)).

## TypeScript (Node & Bun)

First build the native addon once:

```sh
cd ../../bindings/napi && bun install && bun run build
```

Then run the example from the `ts/` folder:

```sh
cd ts
bun install
bun run start          # Bun
bun run start:node     # Node (23.6+ runs .ts directly; on 22.x add --experimental-strip-types)
```

Uses `import { Circomkit } from "circomkit"` (see [`ts/index.ts`](./ts/index.ts)).
The `circomkit` dependency is linked locally to `bindings/napi` via `file:`.
