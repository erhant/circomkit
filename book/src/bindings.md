# Node.js & Bun

The `circomkit` npm package (built with [napi-rs](https://napi.rs)) is **both** the native library and the CLI, in one package:

```sh
npm install circomkit
bun add circomkit
```

> [!NOTE]
>
> The CLI (`circomkit …`) is the same native Rust binary described in the [CLI Reference](./cli.md), launched from the package.

## Library usage

The `Circomkit` class mirrors the Rust orchestrator. It's a typed TypeScript
facade over the native binding, so you pass plain objects (with `bigint`
support) — no `JSON.stringify`. Methods are synchronous; path-returning methods
return the path as a string.

```ts
import { Circomkit } from "circomkit";

// From a circomkit.json, or from a config object:
const ck = Circomkit.fromFile("./circomkit.json");
// const ck = Circomkit.fromConfig({ /* CircomkitConfig */ });

ck.compile("multiplier_3");

const info = ck.info("multiplier_3");
// { wires, constraints, primeName, ... }

// Inline input signals as an object:
ck.witness("multiplier_3", "default", { in: [2, 4, 10] });

ck.setup("multiplier_3"); // auto-downloads PTAU for bn128
ck.prove("multiplier_3", "default", { in: [2, 4, 10] });
const ok = ck.verify("multiplier_3", "default"); // boolean
```

## API surface

`Circomkit.fromFile(path)`, `Circomkit.fromConfig(config)`, the lifecycle
methods (`instantiate`, `compile`, `info`, `clear`, `ptau`, `setup`, `vkey`,
`contract`, `witness`, `prove`, `verify`, `calldata`, `loadInput`), and the
tester factories `WitnessTester` and `ProofTester`.

- `info` returns an object (`wires`, `constraints`, `privateInputs`,
  `publicInputs`, `publicOutputs`, `usesCustomGates`, `labels`, `prime`,
  `primeName`).
- `setup` returns `{ pkeyPath, vkeyPath }`.
- `prove` / `witness` take optional inline signals (an object); `prove` also
  takes an optional backend override, which is `"snarkjs"` here. The native
  backends listed in [Backends](./backends.md) are not shipped in the npm
  addon — they cover only groth16 on a single curve each and cannot verify, so
  they stay behind Rust feature flags. Reach for the crate or the CLI if you
  need them.

`circom` and `snarkjs` must be on your `PATH` at runtime, exactly as with the
CLI. See `index.d.ts` for exact types.

## Testing

The Rust testers are exposed as typed, generic classes — write circuit tests in
your JS test runner with the same shape as the Rust API. `ck.WitnessTester(name)`
(compiling the circuit if needed) returns a `WitnessTester`, generic over the
input/output signal names (the method is capitalized to match the original
TypeScript Circomkit API):

```ts
const t = ck.WitnessTester<["in"], ["out"]>("multiplier_3");

// correctness — objects, typed against the signal names
t.expectPass({ in: [2, 4, 10] }, { out: 80 });
t.expectFail({ in: [1, 4, 10] });          // rejected
t.expectConstraintCount(15, true);

// soundness: tamper with a witness
const w = t.calculateWitness({ in: [2, 4, 10] });
const bad = t.editWitness(w, { "main.out": "1234" });
```

You can also pass an inline circuit config as a second argument
(`ck.WitnessTester("name", { file, template, params })`) instead of registering
it in `circomkit.json`.

The witness is an opaque handle (`Witness`) — it stays on the native side, so
`calculate → edit` doesn't copy the whole vector into JS; use
`readWitnessSignals(w, names)` when you want concrete values.
`ck.ProofTester("multiplier_3", "groth16")` returns a `ProofTester` with
`prove` (→ `{ proof, publicSignals }`), `verify`, `expectPass`, `expectFail`
(run `setup` first).

## Requirements

- Node.js ≥ 20 (Node 23.6+ can run `.ts` examples directly), or Bun.
- `circom` and `snarkjs` on `PATH`.

A runnable example (Node & Bun) lives in `examples/multiplier/ts/`.
