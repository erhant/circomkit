<p align="center">
  <h1 align="center">
    Circomkit
  </h1>
  <p align="center">An opinionated Circom circuit development & testing environment..</p>
</p>

<p align="center">
    <a href="https://opensource.org/licenses/MIT" target="_blank">
        <img src="https://img.shields.io/badge/license-MIT-yellow.svg">
    </a>
    <a href="./.github/workflows/styling.yml" target="_blank">
        <img alt="Style Workflow" src="https://github.com/erhant/circomkit/actions/workflows/styling.yml/badge.svg?branch=main">
    </a>
    <a href="https://mochajs.org/" target="_blank">
        <img alt="Test Suite: Mocha" src="https://img.shields.io/badge/tester-mocha-8D6748?logo=Mocha">
    </a>
    <a href="https://eslint.org/" target="_blank">
        <img alt="Linter: ESLint" src="https://img.shields.io/badge/linter-eslint-8080f2?logo=eslint">
    </a>
    <a href="https://prettier.io/" target="_blank">
        <img alt="Formatter: Prettier" src="https://img.shields.io/badge/formatter-prettier-f8bc45?logo=prettier">
    </a>
    <a href="https://github.com/google/gts" target="_blank">
        <img alt="GTS" src="https://img.shields.io/badge/code%20style-google-4285F4?logo=google">
    </a>
</p>

## Usage

Clone the repository or create a new one with this as the template! You need [Circom](https://docs.circom.io/getting-started/installation/) to compile circuits. Other than that, just `yarn` or `npm install` to get started. It will also install [Circomlib](https://github.com/iden3/circomlib/tree/master/circuits) which has many utility circuits.

The repository follows an _opinionated file structure_ shown below, abstracting away the pathing and orientation behind the scenes. Shell scripts handle most of the work, and they are exposed through a [CLI](./scripts/main.sh).

```sh
circomkit
├── circuit.config.cjs # configs for circuit main components
├── .cli.env # environment variables for cli
├── circuits # where you write templates
│   ├── main # auto-generated main components
│   │   │── sudoku_9x9.circom # e.g. a 9x9 sudoku board
│   │   └── ...
│   │── sudoku.circom # a generic sudoku template
│   └── ...
├── inputs # where you write JSON inputs per circuit
│   ├── sudoku_9x9 # each main template has its own folder
│   │   ├── example-input.json # e.g. a solution & its puzzle
│   │   └── ...
│   └── ...
├── ptau # universal phase-1 setups
│   ├── powersOfTau28_hez_final_12.ptau
│   └── ...
└── build # build artifacts, these are .gitignore'd
    │── sudoku_9x9 # each main template has its own folder
    │   │── sudoku_9x9_js # artifacts of compilation
    │   │   │── generate_witness.js
    │   │   │── witness_calculator.js
    │   │   └── sudoku_9x9.wasm
    │   │── example-input # artifacts of witness & proof generation
    │   │   │── proof.json # proof object
    │   │   │── public.json # public signals
    │   │   └── witness.wtns
    │   │── ... # folders for other inputs
    │   │── sudoku_9x9.r1cs
    │   │── sudoku_9x9.sym
    │   │── prover_key.zkey
    │   └── verification_key.json
    └── ...
```

Write your circuits under the `circuits` folder; the circuit code itself should be templates only. The main component itself is created automatically via a [script](./scripts/instantiate.js) which uses a simple EJS [template](./circuits/ejs/_template.circom) to create the main component. The target circuits are defined under the [circuit configs](./circuit.config.cjs) file, such as:

```js
multiplier_3: {
  // template to instantiate the main component
  template: 'Multiplier',
  // file to include for the template
  file: 'multiplier',
  // array of public inputs
  publicInputs: [],
  // template parameters, order is important
  templateParams: [3],
}
```

Use the [CLI](./scripts/cli.sh), or its wrapper scripts in [package.json](./package.json) to do stuff with your circuits.

```bash
# first argument is ALWAYS the circuit name
yarn compile circuit-name [-d directory-name (default: main)]
yarn ptau    circuit-name -p phase1-ptau-path [-n num-contribs (default: 1)]
yarn prove   circuit-name -i input-name
yarn verify  circuit-name -i input-name
yarn clean   circuit-name
yarn test    circuit-name
yarn test:all
```

There are some environment variables that the CLI can make use of, they are written under [.cli.env](./.cli.env) file.

## Testing

To run Mocha tests do the following:

```bash
# run all tests
yarn test:all
# run a specific test
yarn test "circuit name"
```

### Witness Computation

TODO

### Proof Verification

TODO

## Examples

We have several example circuits to help guide you:

- **Multiplier**: A circuit to prove that you know the factors of a number.
- **Floating Point Addition**: A circuit to compute the sum of two floating-point numbers, as written in [Berkeley ZKP MOOC 2023 - Lab 1](https://github.com/rdi-berkeley/zkp-mooc-lab).
- **Fibonacci**: A circuit to compute Fibonacci numbers.
- **Sudoku**: A circuit to prove that you know the solution to a Sudoku puzzle.

## Styling

The code uses Google TypeScript Style guide. It also has some folder & file icon overrides for several Material UI icons to make things look better in VSCode.
