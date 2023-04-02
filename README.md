# Circomkit

> An opinionated Circom circuit development environment.

You can develop & test Circom circuits with ease using this repository. We have several example circuits to help guide you:

- **Multiplier**: Proves that you know the factors of a number.
- **Floating Point Addition**: A floating-point addition circuit, as written in [Berkeley ZKP MOOC 2023- Lab 1](https://github.com/rdi-berkeley/zkp-mooc-lab).
- **Fibonacci**: Calculate N'th Fibonacci number, has both recursive & iterative implementations.
- **Sudoku**: Prove that you know the solution to a sudoku puzzle where the board size is a perfect square.

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

Write your circuits under `circuits` folder; the circuit code itself should be templates only. The main component itself is created automatically via a [script](./scripts/instantiate.js) which uses a simple EJS [template](./circuits/ejs/_template.circom) to create the main component. The target circuits are defined under the [circuit configs](./circuit.config.cjs) file, such as:

```js
multiplier3: {
  template: 'Multiplier', // template to instantiate the main component
  file: 'multiplier', // file to include for the template
  publicInputs: [], // array of public inputs
  templateParams: [3], // template parameters, order is important
}
```

Use the [CLI](./scripts/cli.sh), or its wrapper scripts in [package.json](./package.json) to do stuff with your circuits.

```bash
# first argument is ALWAYS the circuit name
yarn compile circuit-name
yarn clean   circuit-name
yarn ptau    circuit-name -n num-contribs -p phase1-ptau-path
yarn prove   circuit-name -i input-name
yarn verify  circuit-name -i input-name
yarn test    circuit-name
yarn test:all
```

There are some environment variables that the CLI can make use of, they are written under [.cli.env](./.cli.env) file.

## Testing

To run Mocha tests do the following:

```bash
# run all tests
yarn test
# run a specific test
yarn --grep "circuit name"
```

Within each test, there are two sub-tests:

- **Witness Computation** will test whether witness computations are matching the expectations & the constraints hold.
- **Proof Validation** will test whether proof generation & verification works correctly. This requires the **WASM file**, **prover key**, and **verification key** to be calculated beforehand.

## Styling

The code uses Google TypeScript Style guide. It also has some folder & file icon overrides for several Material UI icons to make things look better in VSCode.
