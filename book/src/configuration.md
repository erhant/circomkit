# Configuration

Everything is driven by a single `circomkit.json`.

Print the resolved configuration with `circomkit config`:

```json
{
  "$schema": "./schema.json",
  "prover": {
    "protocol": "groth16",
    "backend": "snarkjs",
    "ptauDir": "./ptau",
    "inputDir": "./inputs"
  },
  "compiler": {
    "prime": "bn128",
    "srcDir": "./circuits",
    "outDir": "./build",
    "optimization": 1
  },
  "witness": { "calculator": "wasm" },
  "logLevel": "info",
  "circuits": {
    "multiplier_3": {
      "file": "multiplier",
      "template": "Multiplier",
      "params": [3]
    }
  },
  "version": "2.1.0"
}
```

## Sections

### `prover`

| Field      | Values                               | Notes                         |
| ---------- | ------------------------------------ | ----------------------------- |
| `protocol` | `groth16`, `plonk`, `fflonk`         | proving system                |
| `backend`  | `snarkjs`, `arkworks`, `lambdaworks` | see [Backends](./backends.md) |
| `ptauDir`  | path                                 | where PTAU files live         |
| `inputDir` | path                                 | where input JSONs live        |

### `compiler`

| Field          | Values                                                                        | Notes                 |
| -------------- | ----------------------------------------------------------------------------- | --------------------- |
| `prime`        | `bn128`, `bls12381`, `goldilocks`, `grumpkin`, `pallas`, `vesta`, `secq256r1` | field                 |
| `srcDir`       | path                                                                          | circuit sources       |
| `outDir`       | path                                                                          | build artifacts       |
| `optimization` | `0`, `1`, `2`, …                                                              | PLONK requires `>= 1` |

> Using a prime other than `bn128` makes trusted setup harder — you must supply
> the PTAU files yourself. With `bn128`, Circomkit auto-downloads from the
> [Perpetual Powers of Tau](https://github.com/privacy-scaling-explorations/perpetualpowersoftau)
> (up to 2^28 constraints).

### `witness`

`calculator` selects the witness backend: `wasm` (default) or `c`. See
[Backends](./backends.md).

### `circuits`

Each entry is keyed by the circuit's instance name:

```json
"sudoku_9x9": {
  "file": "sudoku",          // circuits/sudoku.circom
  "template": "Sudoku",      // template to instantiate
  "params": [3],             // template parameters (default [])
  "pubs": ["puzzle"],        // public input signals (default [])
  "overrides": { "version": "2.2.0" }   // per-circuit config overrides
}
```

`pubs` and `params` may be omitted. Per-circuit `overrides` merge on top of the
global sections — handy for, e.g., bumping the circom `version` for a single
circuit that needs newer language features.

## File layout

Circomkit is opinionated about paths (all configurable):

```
circomkit.json
circuits/
  main/                       # auto-generated main components (do not edit)
  <file>.circom
inputs/<circuit>/<input>.json
ptau/
build/<circuit>/              # r1cs, wasm, sym, zkey, vkey, proof, verifier.sol
```

> [!TIP]
>
> For a circuit with a single input, the flat `inputs/<circuit>.json` layout works too.
> Circomkit falls back to it when `inputs/<circuit>/<input>.json` is missing.
