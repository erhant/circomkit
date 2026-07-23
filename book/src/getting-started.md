# Getting Started

## Requirements

Circomkit shells out to external tools for compilation and (by default) proving:

- [`circom`](https://docs.circom.io/getting-started/installation/) (v2.2.x) — the circuit compiler.
- [`snarkjs`](https://github.com/iden3/snarkjs) (v0.7.x, installed globally via npm) — the default proving/setup/verify pipeline.

Both must be on your `PATH`.

> [!TIP]
>
> Run `circomkit doctor` at any time to check your environment (tool versions and OS).

## Installation

Pick whichever fits your setup:

```sh
# Rust (from crates.io)
cargo install circomkit-cli

# npm / Bun (from npm)
npm install -g circomkit
bun add -g circomkit
```

> [!NOTE]
>
> You can also build from source:
>
> ```sh
> # clone the repo
> git clone https://github.com/erhant/circomkit.git
>
> # build binary at target/release/circomkit
> cargo build --release
> ```

## Your first circuit

**1. Create a project** with a `circomkit.json`:

```json
{
  "$schema": "./schema.json", // FIXME: fix schema link
  "prover": { "protocol": "groth16", "backend": "snarkjs" },
  "compiler": { "prime": "bn128", "srcDir": "./circuits", "outDir": "./build" },
  "circuits": {
    "multiplier_3": {
      "file": "multiplier",
      "template": "Multiplier",
      "params": [3]
    }
  }
}
```

**2. Write the circuit** at `circuits/multiplier.circom`:

```cs
pragma circom 2.0.0;

template Multiplier(n) {
    assert(n > 1);
    signal input in[n];
    signal output out;

    signal inner[n - 1];
    inner[0] <== in[0] * in[1];
    for (var i = 2; i < n; i++) {
        inner[i - 1] <== inner[i - 2] * in[i];
    }
    out <== inner[n - 2];
}
```

**3. Provide an input** at `inputs/multiplier_3/default.json` (or just `inputs/multiplier_3.json`):

```json
{ "in": [2, 4, 10] }
```

**4. Run the lifecycle:**

```sh
circomkit compile multiplier_3      # circom -> r1cs, wasm, sym
circomkit setup   multiplier_3      # trusted setup (auto-downloads PTAU for bn128)
circomkit witness multiplier_3 default
circomkit prove   multiplier_3 default
circomkit verify  multiplier_3 default
```

That's it — you've compiled a circuit, run a trusted setup, and produced and
verified a proof. Artifacts land under `build/multiplier_3/`.

> [!TIP]
>
> Optionally, export a Solidity verifier and its calldata:
>
> ```sh
> circomkit contract multiplier_3
> circomkit calldata multiplier_3 default --pretty
> ```

See the [CLI Reference](./cli.md) for every command, and [Testing](./testing.md)
to lock in behavior with real tests.
