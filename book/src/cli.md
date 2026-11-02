# CLI Reference

The `circomkit` binary reads `./circomkit.json` by default; override it with the
global `--config <path>` flag.

```sh
circomkit --help
circomkit --config ./other.json list
```

## Environment & inspection

```sh
circomkit init [dir]          # scaffold a minimal project (default ".")
circomkit doctor [--json]     # check circom/snarkjs and OS
circomkit list                # list configured circuits
circomkit config              # print the resolved configuration
```

`doctor` verifies your toolchain. It exits non-zero if a required tool (circom, snarkjs) is missing, so it works in CI too.

`init` writes `circomkit.json`, `circuits/multiplier.circom`,
`inputs/multiplier_3/default.json`, and `.gitignore` into `dir`, never
overwriting existing files. It works without a `circomkit.json`.

## Building

```sh
circomkit compile <pattern>   # the argument is a REGEX; "multiplier.*" matches many
circomkit instantiate <circuit>   # generate only the main component file
circomkit info <circuit>      # wires, constraints, public/private I/O, prime
circomkit clear <circuit>     # remove build artifacts for a circuit
```

`compile` matches circuit names by regex, so `circomkit compile ".*"` builds everything.

## Setup & keys

```sh
circomkit setup <circuit> [--ptau <path>]   # trusted setup (auto-downloads PTAU for bn128)
circomkit ptau <circuit>      # download the PTAU for a circuit
circomkit vkey <circuit>      # export the verification key
circomkit contract <circuit>  # export a Solidity verifier contract
```

> `setup` optionally takes a PTAU path. If omitted, Circomkit picks and
> downloads the right PTAU based on the constraint count. This only works for
> `bn128` and is capped at 2^28 constraints.

## Witness, prove, verify

Inputs live under `inputs/<circuit>/<input>.json`. An input named `foo` for a
circuit `bar` is at `inputs/bar/foo.json`.

```sh
circomkit witness <circuit> <input>
circomkit prove   <circuit> <input> [--backend snarkjs|arkworks]
circomkit verify  <circuit> <input>
circomkit calldata <circuit> <input> [--pretty]   # Solidity calldata to stdout
```

The `--backend` flag overrides the configured `prover.backend` for a single
`prove` invocation; `verify` uses the configured `prover.backend` (arkworks
verifies in-process, snarkjs via its CLI). See [Backends](./backends.md) for the
valid protocol/curve/backend combinations.

## JSON exports

```sh
circomkit json r1cs <circuit> [-p|--print]
circomkit json zkey <circuit> [-p|--print]           # groth16 only
circomkit json wtns <circuit> <input> [-p|--print]
```

Exports via snarkjs to `<artifact>.json` next to the artifact (e.g.
`build/<circuit>/<circuit>.r1cs.json`); `--print` also prints it.

## Codegen

```sh
circomkit codegen input <circuit> [--save <name>]   # zero-filled input JSON
circomkit codegen wrapper <circuit>                 # tag wrapper for tagged inputs
```

`codegen input` emits the right signal names and array shapes (from the
circuit's template and integer params); `--save` writes
`inputs/<circuit>/<name>.json` instead of printing. `codegen wrapper` prints the
wrapper Circomkit generates for templates with tagged inputs (see
[Configuration](./configuration.md#tagged-inputs)).
