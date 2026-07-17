# CLI Reference

The `circomkit` binary reads `./circomkit.json` by default; override it with the
global `--config <path>` flag.

```sh
circomkit --help
circomkit --config ./other.json list
```

## Environment & inspection

```sh
circomkit doctor [--json]     # check circom/snarkjs, OS, memory, max PTAU
circomkit list                # list configured circuits
circomkit config              # print the resolved configuration
```

`doctor` verifies your toolchain and estimates the largest PTAU power your machine can handle from available memory. It exits non-zero if a required tool (circom, snarkjs) is missing, so it works in CI too.

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
circomkit prove   <circuit> <input> [--backend snarkjs|arkworks|lambdaworks]
circomkit verify  <circuit> <input>
circomkit calldata <circuit> <input> [--pretty]   # Solidity calldata to stdout
circomkit json r1cs <circuit>                     # R1CS metadata as JSON
```

The `--backend` flag overrides the configured `prover.backend` for a single
`prove` invocation. See [Backends](./backends.md) for the valid
protocol/curve/backend combinations.
