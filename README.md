<p align="center">
  <h1 align="center">
    Circomkit
  </h1>
  <p align="center"><i>A simple-to-use & opinionated circuit development & testing toolkit.</i></p>
</p>

<p align="center">
    <a href="https://opensource.org/licenses/MIT" target="_blank">
        <img src="https://img.shields.io/badge/license-MIT-yellow.svg">
    </a>
     <a href="https://www.npmjs.com/package/circomkit" target="_blank">
        <img alt="NPM" src="https://img.shields.io/npm/v/circomkit?logo=npm&color=CB3837">
    </a>
    <a href="./.github/workflows/styles.yml" target="_blank">
        <img alt="Workflow: Styles" src="https://github.com/erhant/circomkit/actions/workflows/styles.yml/badge.svg?branch=main">
    </a>
    <a href="./.github/workflows/build.yml" target="_blank">
        <img alt="Workflow: Build" src="https://github.com/erhant/circomkit/actions/workflows/build.yml/badge.svg?branch=main">
    </a>
    <a href="https://github.com/iden3/snarkjs" target="_blank">
        <img alt="GitHub: SnarkJS" src="https://img.shields.io/badge/github-snarkjs-lightgray?logo=github">
    </a>
    <a href="https://github.com/iden3/circom" target="_blank">
        <img alt="GitHub: Circom" src="https://img.shields.io/badge/github-circom-lightgray?logo=github">
    </a>
</p>

## Installation

Circomkit is an NPM package, which you can install via:

```sh
yarn add circomkit    # yarn
npm install circomkit # NPM
```

You will also need Circom, which can be installed following the instructions [here](https://docs.circom.io/getting-started/installation/).

## Usage

Create an empty project, and install Circomkit. Then, you can setup the environment by simply executing:

```sh
npx circomkit init
```

This command creates the following:

- An example Multiplier circuit, under `circuits` folder.
- A circuit configuration file called `circuits.json`, with an example Multiplier circuit configuration.
- An example input JSON file for Multiplier, under `inputs/multiplier` folder.
- A test using Mocha, under `tests` folder.
- A Mocha configuration file.

Although Circomkit initializes with a Mocha test, uses Chai in the background so you could use anything that supports Chai. You should check out [circomkit-examples](https://github.com/erhant/circomkit-examples) repo as an example!

### Circuit Configuration

A circuit config within `circuits.json` looks like below, where the `key` is the circuit name to be used in commands, and the value is an object that describes the filename, template name, public signals and template parameters:

```js
sudoku_9x9: {
  file:     'sudoku',
  template: 'Sudoku',
  pubs:     ['puzzle'],
  params:   [3], // sqrt(9)
},
```

You can omit `pubs` and `params` options, they default to `[]`.

### Command Line Interface

Actions that require a circuit name can be called as follows:

```bash
# Compile the circuit
npx circomkit compile circuit

# Create the main component
npx circomkit instantiate circuit

# Create a Solidity verifier contract
npx circomkit contract circuit

# Clean circuit artifacts
npx circomkit clean circuit

# Circuit-specific setup
npx circomkit setup circuit [ptau-path]
```

Circuit-specific setup optionally takes the path to a PTAU file as argument. If not provided, it will automatically decide the PTAU to use with respect to constraint count, and download it for you! This feature only works for `bn128` curve.

Some actions such as generating a witness, generating a proof and verifying a proof require JSON inputs to provide the signal values. For that, we specifically create our input files under the `inputs` folder, and under the target circuit name there. For example, an input named `foo` for some circuit named `bar` would be at `inputs/bar/foo.json`.

```bash
# Generate a witness
npx circomkit witness circuit input

# Generate a proof
npx circomkit prove circuit input

# Verify a proof with public signals
npx circomkit verify circuit input

# Export Solidity calldata to console
npx circomkit calldata circuit input
```

## Circomkit Configuration

Everything used by Circomkit can be optionally overridden by providing the selected fields in its constructor. Circomkit CLI does this automatically by checking out `circomkit.json` and overriding the defaults with that. You can print the active configuration via the following command:

```sh
npx circomkit config
```

You can edit any of the fields there to fit your needs.

### Logger

SnarkJS uses [logplease](https://www.npmjs.com/package/logplease) internally where functions expect a logger as an optional last argument. Circomkit uses [loglevel](https://www.npmjs.com/package/loglevel) instead, which has the same interface and is much more popular.

## File Structure

Circomkit with its default configuration follows an _opinionated file structure_, abstracting away the pathing and orientation behind the scenes. All of these can be customized by overriding the respective settings in `circomkit.json`.

Here is an example structure, where we have a generic Sudoku proof-of-solution circuit, and we instantiate it for a 9x9 board:

```sh
circomkit
├── circuits.json # circuit configs
├── circomkit.json # customizations
│
├── circuits
│   ├── main
│   │   └── sudoku_9x9.circom
│   └── sudoku.circom
│
├── inputs
│   └── sudoku_9x9
│       └── my_solution.json
│
├── ptau
│   └── powersOfTau28_hez_final_12.ptau
│
└── build
    └── sudoku_9x9
        │── sudoku_9x9_js
        │   │── generate_witness.js
        │   │── witness_calculator.js
        │   └── sudoku_9x9.wasm
        │
        │── my_solution
        │   │── proof.json
        │   │── public.json
        │   └── witness.wtns
        │
        │── sudoku_9x9.r1cs
        │── sudoku_9x9.sym
        │── prover_key.zkey
        └── verifier_key.json

```

## Styling

Circomkit uses [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html).

```bash
# check the formatting
yarn format

# lint everything
yarn lint

# do both at once
yarn style
```
