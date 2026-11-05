<p align="center">
  <h1 align="center">
    Circomkit
  </h1>
  <p align="center"><i>A simple-to-use & opinionated circuit development & testing toolkit.</i></p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/circomkit" target="_blank">
        <img alt="NPM" src="https://img.shields.io/npm/v/circomkit?logo=npm&color=CB3837">
    </a>
    <a href="./.github/workflows/tests.yml" target="_blank">
        <img alt="Workflow: Tests" src="https://github.com/erhant/circomkit/actions/workflows/tests.yml/badge.svg?branch=main">
    </a>
    <a href="https://opensource.org/licenses/MIT" target="_blank">
        <img src="https://img.shields.io/badge/license-MIT-blue.svg">
    </a>
</p>

- [x] Simple CLI, abstracting away all paths with a simple config.
- [x] Type-safe testing utilities to check circuit computations & soundness errors, with minimal boilerplate, for any test runner.
- [x] Supports all protocols: `groth16`, `plonk`, and `fflonk`.
- [x] Automatically downloads phase-1 PTAU when using `bn128`.
- [x] Exports a Solidity verifier contract and its calldata, or JSON for the R1CS, prover key and witness.
- [x] WASM & C witness calculators, on Node.js and Bun.

## Installation

Install Circomkit along with [SnarkJS](https://github.com/iden3/snarkjs) (0.7.5 or newer), which Circomkit uses for proofs:

```sh
npm  install circomkit snarkjs
pnpm install circomkit snarkjs
yarn add     circomkit snarkjs
bun  add     circomkit snarkjs
```

You will also need the [Circom](https://docs.circom.io) compiler, see its [installation guide](https://docs.circom.io/getting-started/installation/). Circomkit works with Circom 2.1.5 and newer, which are tested in CI, and tells you when a feature needs a newer version (see [Circom versions](#circom-versions)).

## Quick Start

Create a new project with an example circuit, then prove & verify it:

```sh
npx circomkit init                # creates circomkit.json, a circuit and an input
npx circomkit prove multiplier_3  # compiles, sets up and proves, with inputs/multiplier_3.json
npx circomkit verify multiplier_3
```

`init` does not overwrite existing files, and works offline. For more, see the cookbooks in [examples](#examples).

## Command Line Interface

The CLI reads its configuration from `circomkit.json` in the current directory, see [Configuration](#configuration). You can see all commands with `npx circomkit help`, and print the active configuration with `npx circomkit config`.

Commands that take a circuit name:

```sh
# Compile a circuit, or all circuits matching a regular expression (all circuits if omitted)
npx circomkit compile [circuit]

# Create the main component of a circuit
npx circomkit instantiate <circuit>

# Print information about a compiled circuit, e.g. its number of constraints
npx circomkit info <circuit>

# Print the constraints of a compiled circuit as formulas, e.g. `in[0] * in[1] = inner[0]`
npx circomkit constraints <circuit>
# Only the constraints that use a signal or component, e.g. `isZero[0]` or `out`
npx circomkit constraints <circuit> --filter <signal>

# Circuit-specific setup, creates the prover & verifier keys
npx circomkit setup <circuit> [ptau-path]

# Export the verification key
npx circomkit vkey <circuit> [pkey-path]

# Download the PTAU file for a circuit (bn128 only)
npx circomkit ptau <circuit>

# Export a Solidity verifier contract
npx circomkit contract <circuit>

# Clear the build artifacts of a circuit
npx circomkit clear <circuit>
```

> [!NOTE]
>
> If you don't give `setup` a PTAU file, it picks the smallest one that fits the circuit and downloads it from [Perpetual Powers of Tau](https://github.com/privacy-scaling-explorations/perpetualpowersoftau). This only works for the `bn128` prime, for circuits of up to $2^{28}$ constraints. For other primes, you have to provide the PTAU file yourself.

Commands that need signal values read them from an input file at `<dirInputs>/<circuit>/<input>.json`. For example, an input named `foo` for a circuit named `bar` is read from `inputs/bar/foo.json`. The input is named `default` if omitted, which can also be at `inputs/bar.json` for circuits with a single input.

```sh
# Calculate a witness, add --c to use the C witness calculator
npx circomkit witness <circuit> [input]

# Create a proof, compiling & setting up the circuit first if needed
npx circomkit prove <circuit> [input]

# Verify a proof with its public signals
npx circomkit verify <circuit> [input]

# Print the calldata for the Solidity verifier
npx circomkit calldata <circuit> [input]
```

Other commands:

```sh
# List circuit templates & configured circuits
npx circomkit list

# Export JSON of the R1CS, the prover key (Groth16 only) or a witness, add -p to print instead of saving
npx circomkit json r1cs <circuit>
npx circomkit json zkey <circuit>
npx circomkit json wtns <circuit> [input]
```

## Configuration

Circomkit is configured with `circomkit.json`. Every field is optional, as each has a default. The most common fields are:

| Field          | Default              | Description                                                                                     |
| -------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `protocol`     | `"groth16"`          | Proof system: `groth16`, `plonk` or `fflonk`.                                                   |
| `prime`        | `"bn128"`            | Prime field: `bn128`, `bls12381`, `bls12377`, `goldilocks`, `grumpkin`, `pallas`, `vesta` or `secq256r1`. |
| `circuits`     | `"./circuits.json"`  | The circuits, or a path to a JSON file with them, see [Circuits](#circuits).                    |
| `dirCircuits`  | `"./circuits"`       | Directory of your circuit files.                                                                |
| `dirInputs`    | `"./inputs"`         | Directory of input files.                                                                       |
| `dirBuild`     | `"./build"`          | Directory of build artifacts.                                                                   |
| `dirPtau`      | `"./ptau"`           | Directory of PTAU files.                                                                        |
| `circomPath`   | `"circom"`           | The Circom compiler, a path or a command such as `npx circom2`.                                 |
| `optimization` | Circom's default     | Constraint simplification level: `0`, `1`, `2`, or a number above 2 for that many `--O2round`s. |
| `include`      | `["./node_modules"]` | Library paths for `include` statements, e.g. for `circomlib`.                                   |
| `version`      | `"2.1.0"`            | The `pragma circom` version of generated main components.                                       |
| `cWitness`     | `false`              | Also build the C witness calculator when compiling.                                             |
| `verbose`      | `true`               | Show SnarkJS logs.                                                                              |
| `logLevel`     | `"INFO"`             | Circomkit's log level, e.g. `"SILENT"`.                                                         |

See [`src/configs/index.ts`](./src/configs/index.ts) for all fields.

PLONK requires optimization level 1, so Circomkit uses it for PLONK circuits.

> [!TIP]
>
> Add a `$schema` to get completion and validation in your editor:
>
> ```json
> {
>   "$schema": "./node_modules/circomkit/schema.json",
>   "protocol": "plonk"
> }
> ```
>
> For a separate `circuits.json`, use `./node_modules/circomkit/circuits.schema.json`.

### Circuits

Each circuit has a name, used in all commands, and a configuration that describes how to create its main component:

```json
{
  "sudoku_9x9": {
    "file": "sudoku",
    "template": "Sudoku",
    "pubs": ["puzzle"],
    "params": [3]
  }
}
```

This creates the main component `component main {public [puzzle]} = Sudoku(3);` from the template `Sudoku` in `circuits/sudoku.circom`. The fields are:

| Field                 | Description                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `file`                | The circuit file in `dirCircuits`, without the `.circom` extension.                       |
| `template`            | The template to instantiate.                                                              |
| `params`              | Template parameters, defaults to `[]`.                                                    |
| `pubs`                | Public input signals, defaults to `[]`.                                                   |
| `dir`                 | Directory in `dirCircuits` to create the main component at, defaults to `main`.           |
| `version`             | The `pragma circom` version of the main component, defaults to the global `version`.      |
| `usesCustomTemplates` | Adds `pragma custom_templates;` to the main component.                                    |
| `overrides`           | Configuration for this circuit only, see [Per-circuit overrides](#per-circuit-overrides). |

The circuits can be in a separate file such as `circuits.json`, with `"circuits": "./circuits.json"` in `circomkit.json`, which is the default. They can also be written within `circomkit.json`:

```json
{
  "circuits": {
    "sudoku_9x9": {"file": "sudoku", "template": "Sudoku", "pubs": ["puzzle"], "params": [3]}
  }
}
```

### Per-circuit overrides

A circuit's `overrides` change the configuration for that circuit only. Any field can be overridden except `circuits` and `logLevel`:

```json
{
  "protocol": "groth16",
  "circuits": {
    "sudoku_9x9": {"file": "sudoku", "template": "Sudoku", "params": [3], "overrides": {"protocol": "plonk"}},
    "multiplier_3": {"file": "multiplier", "template": "Multiplier", "params": [3]}
  }
}
```

Here `sudoku_9x9` is proven with PLONK, and `multiplier_3` with Groth16.

## Using Circomkit in Code

All CLI commands, except `init`, `list` and `config`, are methods of `Circomkit` with the same name and arguments. In code, you can also pass the circuit configuration & input signals directly, instead of having them read from files:

```ts
import {Circomkit} from 'circomkit';

const circomkit = new Circomkit({
  // same fields as `circomkit.json`
  protocol: 'plonk',
});

// artifacts are created under `build/multiplier_3`
await circomkit.compile('multiplier_3', {
  file: 'multiplier',
  template: 'Multiplier',
  params: [3],
});

// proof & public signals are created under `build/multiplier_3/my_input`
await circomkit.prove('multiplier_3', 'my_input', {in: [3, 5, 7]});

// verifies the proof & public signals under `build/multiplier_3/my_input`
await circomkit.verify('multiplier_3', 'my_input');
```

> [!NOTE]
>
> The constructor does not read `circomkit.json`, only the CLI does. Pass `JSON.parse(readFileSync('circomkit.json', 'utf-8'))` to use it in code.

## Writing Tests

Circomkit provides two testers, which throw on failure, so they work with any test runner such as Vitest, Jest, Mocha or `bun test`. The examples below use Vitest.

### Witness Tester

The witness tester computes witnesses for your inputs, and checks them against the constraints & expected outputs:

- `expectPass(input)` checks that the witness is computed and satisfies the constraints.
- `expectPass(input, output)` additionally checks the output signals. They are compared in the field, so `-1` matches `p - 1`, and can be given as numbers, bigints or strings, e.g. `'0xff'`.
- `expectFail(input)` checks that the witness computation fails, e.g. due to a failed `assert` or `===`, a missing input or a modulo by zero. It returns the error message.

```ts
import {Circomkit, type WitnessTester} from 'circomkit';

describe('multiplier', () => {
  // the names of input & output signals make all functions type-safe
  let circuit: WitnessTester<['in'], ['out']>;

  beforeAll(async () => {
    const circomkit = new Circomkit();
    circuit = await circomkit.WitnessTester('multiplier_3', {
      file: 'multiplier',
      template: 'Multiplier',
      params: [3],
    });
  });

  it('should multiply', async () => {
    await circuit.expectPass({in: [2, 3, 5]}, {out: 30});
  });

  it('should fail for a bad input', async () => {
    await circuit.expectFail({in: [2, 3]});
  });
});
```

`WitnessTester` creates the main component under `circuits/test`, and compiles it under `<dirBuild>/.witness-tester`. Compiling is skipped when nothing changed since the last compile: the circuit, the files it includes, its parameters and the compiler options. Pass `recompile: true` in the circuit configuration to always compile, or `recompile: false` to never compile. Each version of a circuit gets its own build, which is kept until you remove it with `clear(circuit)` (or `npx circomkit clear <circuit>`), or by deleting `<dirBuild>/.witness-tester`.

> [!NOTE]
>
> The witness tester compiles with at most optimization level 1, even if `optimization` is higher, so that fewer of your signals are simplified away. Level 1 can still remove a signal that is a constant multiple of another, e.g. `out <== 2 * in`, and reading it then throws an error. To test with another level, set it in the circuit's overrides, e.g. `{file, template, overrides: {optimization: 2}}`.

#### Constraints

```ts
// expects at least N constraints
await circuit.expectConstraintCount(N);
// expects exactly N constraints
await circuit.expectConstraintCount(N, true);
```

`constraints()` returns the constraints as human-readable formulas, which helps to spot under-constrained signals:

```ts
console.log((await circuit.constraints()).join('\n'));
// in[0] * in[1] = inner[0]
// inner[0] * in[2] = out
// isZero[0].in * isZero[0].inv = 1
// in[0] - isZero[0].in - 1 = 0
// ...

// only the constraints that use a signal or component, with their index
console.log(await circuit.constraints('isZero[0]'));
// [ '#2: isZero[0].in * isZero[0].inv = 1', '#3: in[0] - isZero[0].in - 1 = 0' ]
```

For large circuits, `circomkit.streamConstraints(circuit, filter?)` yields the formulas one by one instead.

#### Reading signals

`compute` calculates the witness and returns the signals you ask for, by their name in the main component:

```ts
const output = await circuit.compute({in: [2, 3, 5]}, ['out']);
expect(output.out).toBe(BigInt(30));
```

Arrays are returned as arrays and buses as objects, and you can also ask for a part of them, such as `out[1]` or `point.x`. Signals of a subcomponent are named `component.signal`, e.g. `hasher.out` or `hashers[0].out`.

To read signals from a witness, use `readWitnessSignals(witness, signals)` the same way. `readWitness(witness, symbols)` reads single values by their full symbol name, such as `main.component.signal[0]`.

If Circom's optimizations removed a signal, reading it throws an error. Use a lower optimization level to keep it.

#### Soundness

To check for soundness errors, i.e. under-constrained signals, edit a witness and check that the constraints fail for it:

- `calculateWitness(input)` computes a witness.
- `editWitness(witness, symbols)` returns a copy with the given symbols set to new values.
- `expectConstraintPass(witness)` and `expectConstraintFail(witness)` check the constraints.

```ts
it('should fail for a fake witness', async () => {
  const witness = await circuit.calculateWitness({in: [2, 3, 5]});
  const fakeWitness = await circuit.editWitness(witness, {
    'main.out': BigInt(31),
    'main.component.signal': BigInt('0xCAFE'),
    'main.foo.bar[0]': BigInt('0b0101'),
  });
  await circuit.expectConstraintFail(fakeWitness);
});
```

Symbols are named `main.<component>.<signal>`. Anonymous components such as `Square()(in)` are named `<Template>_<line>_<offset>`, where `offset` is the byte offset of the call in its file, e.g. `main.Square_3_158.out`. You can find all symbols in the `.sym` file of the build.

#### C witness calculator

The C witness calculator can be faster than WASM for large circuits. Pass `'c'` as the third argument:

```ts
const circuit = await circomkit.WitnessTester('multiplier_3', config, 'c');
```

It needs a C++ compiler, `make` and the GMP & [nlohmann/json](https://github.com/nlohmann/json) libraries. On Debian & Ubuntu:

```sh
sudo apt install build-essential libgmp-dev nlohmann-json3-dev nasm
```

On macOS, with the Xcode command line tools (`xcode-select --install`) and [Homebrew](https://brew.sh):

```sh
brew install gmp nlohmann-json # and nasm on Intel Macs
```

Circomkit adds the headers & libraries of Homebrew when it builds, as the compiler does not look for them on Apple Silicon.

On machines that are not x86-64, such as Apple Silicon or ARM Linux, Circomkit compiles with `--no_asm` (Circom's assembly is x86-64 only), which needs Circom 2.2.2 or newer. There, `nasm` is not needed.

To calculate witnesses with C outside of tests, set `cWitness: true` and use `npx circomkit witness <circuit> [input] --c`.

### Proof Tester

The proof tester creates proofs and verifies them, with the circuit's WASM, prover key and verification key. Compile & set up the circuit before creating it:

```ts
import {Circomkit, type ProofTester} from 'circomkit';

describe('multiplier proofs', () => {
  let circuit: ProofTester<['in'], 'plonk'>;

  beforeAll(async () => {
    const circomkit = new Circomkit({protocol: 'plonk'});
    await circomkit.compile('multiplier_3', {file: 'multiplier', template: 'Multiplier', params: [3]});
    await circomkit.setup('multiplier_3');
    circuit = await circomkit.ProofTester('multiplier_3', 'plonk');
  });

  it('should verify a proof', async () => {
    const {proof, publicSignals} = await circuit.prove({in: [2, 3, 5]});
    await circuit.expectPass(proof, publicSignals);
  });

  it('should not verify a proof with other public signals', async () => {
    const {proof} = await circuit.prove({in: [2, 3, 5]});
    await circuit.expectFail(proof, ['31']);
  });
});
```

SnarkJS keeps worker threads running after proving & verifying. Test runners exit anyway, but in a script, call `teardown()` at the end so that it can exit:

```ts
import {Circomkit, teardown} from 'circomkit';

// ... prove & verify
await teardown();
```

### Type-Safety

Both testers take the signal names as optional type parameters: `WitnessTester<Inputs, Outputs>` and `ProofTester<Inputs, Protocol>`. For a circuit with inputs `in1, in2` and an output `out`, `WitnessTester<['in1', 'in2'], ['out']>` type-checks all inputs & outputs you pass to it.

## File Structure

Circomkit follows an opinionated file structure, which you can change with the `dir*` fields in `circomkit.json`. Below is an example with a Sudoku circuit, instantiated for a 9x9 board as `sudoku_9x9`, and proven with Groth16:

```ml
project
├── circomkit.json - "Circomkit configuration"
├── circuits.json - "circuit configurations, unless written in circomkit.json"
│
├── circuits - "your circuit code"
│   ├── sudoku.circom - "circuit templates"
│   ├── main - "main components, created by Circomkit"
│   │   └── sudoku_9x9.circom
│   └── test - "main components of witness testers, created by Circomkit"
│       └── sudoku_9x9.circom
│
├── inputs - "input signals"
│   ├── sudoku_9x9 - "named after the circuit"
│   │   └── my_solution.json - "named after the input"
│   └── sudoku_9x9.json - "the default input, as an alternative to sudoku_9x9/default.json"
│
├── ptau - "PTAU files"
│   └── powersOfTau28_hez_final_08.ptau
│
└── build - "build artifacts"
    ├── .witness-tester - "builds of witness testers"
    └── sudoku_9x9 - "named after the circuit"
        ├── sudoku_9x9_js - "WASM witness calculator"
        │   ├── generate_witness.js
        │   ├── witness_calculator.js
        │   └── sudoku_9x9.wasm
        ├── sudoku_9x9_cpp - "C witness calculator, if enabled"
        │
        ├── my_solution - "named after the input"
        │   ├── groth16_proof.json - "proofs are named after the protocol"
        │   ├── public.json - "public signals"
        │   └── witness.wtns
        │
        ├── sudoku_9x9.r1cs - "constraints"
        ├── sudoku_9x9.sym - "symbols, used by the witness tester"
        │
        ├── groth16_pkey.zkey - "prover key, named after the protocol"
        ├── groth16_vkey.json - "verification key, named after the protocol"
        └── groth16_verifier.sol - "verifier contract"
```

## Circom Versions

Circomkit does not require a minimum Circom version. Features that need a newer Circom check for it, and tell you which version they need:

- C witness calculation on machines that are not x86-64 needs Circom 2.2.2 or newer.

CI tests Circomkit with Circom 2.1.5 and 2.2.3.

## Examples

The [examples](./examples/) are two small projects, each a full stack: [Sudoku with Node.js](./examples/node-sudoku/), with witness tests, Groth16, PLONK & FFLONK and the C witness calculator, and [SHA-256 with Bun](./examples/bun-sha256/), with a Solidity verifier tested with Foundry.

## Development

```sh
pnpm install
pnpm test       # tests with Vitest, needs circom
pnpm test:bun   # the same tests with Bun
pnpm check      # type-check
pnpm lint       # lint with Biome
pnpm format     # check formatting with Prettier
```

> [!TIP]
>
> `pnpm cli` builds Circomkit and runs its CLI, as if you were using `npx circomkit`, e.g. `pnpm cli list`.

## Acknowledgements

We wholeheartedly thank [BuidlGuild](https://buidlguidl.com/) & [Austin Griffith](https://twitter.com/austingriffith) for providing Circomkit with an [Ecosystem Impact Grant](https://grants.buidlguidl.com/)!
