<p align="center">
  <h1 align="center">
    Circomkit
  </h1>
  <p align="center"><i>A simple-to-use Circom & SnarkJS circuit development & testing environment.</i></p>
</p>

<p align="center">
    <a href="https://opensource.org/licenses/MIT" target="_blank">
        <img src="https://img.shields.io/badge/license-MIT-yellow.svg">
    </a>
    <a href="./.github/workflows/styles.yml" target="_blank">
        <img alt="Workflow: Styles" src="https://github.com/erhant/circomkit/actions/workflows/styles.yml/badge.svg?branch=main">
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
    <a href="https://github.com/iden3/snarkjs" target="_blank">
        <img alt="GitHub: SnarkJS" src="https://img.shields.io/badge/github-snarkjs-lightgray?logo=github">
    </a>
    <a href="https://github.com/iden3/circom" target="_blank">
        <img alt="GitHub: Circom" src="https://img.shields.io/badge/github-circom-lightgray?logo=github">
    </a>
</p>

- [x] **Programmable Circuits**: The `main` component is created & compiled programmatically.
- [x] **Simple CLI**: A straightforward CLI is provided as a wrapper around SnarkJS commands, exposed via NPM scripts!
- [x] **Easily Configurable**: A single `.env` file stores the general configuration settings.
- [x] **Constraint Testing**: You can test computations & assertions for every template in a circuit, with minimal code-repetition.
- [x] **Proof Testing**: With prover & verification keys and the WASM circuit, you can test proof generation & verification.
- [x] **Witness Manipulation**: You can parse the output from a witness, and furthermore create fake witnesses to try and fool the verifier.
- [x] **Type-safe**: Witness & proof testers, as well as circuit signal inputs & outputs are all type-safe via generics.
- [x] **Solidity Exports**: Export a verifier contract in Solidity, or export a calldata for your proofs & public signals.

## Usage

Using Circomkit is easy:

1. Install [Circom](https://docs.circom.io/getting-started/installation/).
2. Clone this repo (or use it as a template) and install packages (`yarn` or `npm install`).
3. Write your circuit templates under the `circuits` folder. Your circuit code itself should be templates only; Circomkit programmatically generates the `main` component
4. Write your tests under the `tests` folder.
5. Once you are ready, write the circuit config in [`circuit.config.ts`](./circuit.config.ts).
6. Use NPM scripts (`yarn <script>` or `npm run <script>`) to compile your circuit, build keys, generate & verify proofs and much more!

A circuit config looks like this:

```js
sudoku_4x4: { // the key is <circuit-name>
  file: 'sudoku', // file name (circuits/sudoku.circom)
  template: 'Sudoku', // template name
  pubs: ['puzzle'], // public signals
  params: [Math.sqrt(4)], // template parameters
  dir: "main" // output directory for main component
},
```

You can omit `pubs`, `params` and `dir` options, they have defaults. Afterwards, you can use the following commands:

```bash
# Compile the circuit (generates the main component too)
yarn compile circuit-name

# Circuit setup
yarn setup circuit-name -p phase1-ptau-path [-n num-contribs (default: 1)]

# Shorthand for `compile` and then `setup`
yarn keygen circuit-name -p phase1-ptau-path [-n num-contribs (default: 1)]

# Create a Solidity verifier contract
yarn contract circuit-name

# Clean circuit artifacts
yarn clean circuit-name

# Generate the `main` component without compiling it afterwards
yarn instantiate circuit-name
```

You can change some general settings such as the configured proof system or the prime field under [`.cli.env`](./.cli.env).

### Working with Input Signals

Some actions such as generating a witness, generating a proof and verifying a proof require JSON inputs to provide the signal values. For that, we specifically create our input files under the `inputs` folder, and under the target circuit name there. For example, an input named `foobar` for some circuit named `circ` would be at `inputs/circ/foobar.json`.

```bash
# Generate a witness for some input
yarn witness circuit-name [-i input-name (default: "default")]

# Generate a proof for some input
yarn prove circuit-name [-i input-name (default: "default")]

# Verify a proof for some input (public signals only)
yarn verify circuit-name [-i input-name (default: "default")]

# Debug a witness of some input
yarn debug circuit-name [-i input-name (default: "default")]

# Export calldata to call your Solidity verifier contract
yarn calldata circuit-name [-i input-name (default: "default")]
```

## Testing

To run tests do the following:

```bash
# test a specific circuit
yarn test <circuit-name>

# test all circuits
yarn test:all
```

You can test both witness calculations and proof generation & verification. We describe both in their respective sections, going over an example of "Multiplication" circuit.

### Example Circuits

We have several example circuits that you can check out. With them, you can prove the following statements:

- **Multiplier**: "I know `n` factors that make up some number".
- **Fibonacci**: "I know the `n`'th Fibonacci number".
- **SHA256**: "I know the `n`-byte preimage of some SHA256 digest".
- **Sudoku**: "I know the solution to some `(n^2)x(n^2)` Sudoku puzzle".
- **Floating-Point Addition**: "I know two floating-point numbers that make up some number with `e` exponent and `m` mantissa bits." (adapted from [Berkeley ZKP MOOC 2023 - Lab 1](https://github.com/rdi-berkeley/zkp-mooc-lab)).

### Witness Calculation

Witness calculation tests check whether your circuit computes the correct result based on your inputs, and makes sure that assertions are correct. We provide very useful utility functions to help write these tests.

```ts
import WasmTester from '../utils/wasmTester';

const N = 3;
describe('multiplier', () => {
  // type-safe signal names ✔
  let circuit: WasmTester<['in'], ['out']>;

  before(async () => {
    circuit = await WasmTester.new(`multiplier_${N}`, {
      file: 'multiplier',
      template: 'Multiplier',
      params: [N], // template parameters ✔
      pubs: [], // public signals ✔
    });
    // constraint count checks ✔
    await circuit.checkConstraintCount(N - 1);
  });

  it('should compute correctly', async () => {
    const randomNumbers = Array.from({length: N}, () => Math.floor(Math.random() * 100 * N));
    await circuit.expectCorrectAssert({in: randomNumbers}, {out: randomNumbers.reduce((prev, acc) => acc * prev)});
  });
});
```

With the circuit object, we can do the following:

- `circuit.expectCorrectAssert(input, output)` to test whether we get the expected output for some given input.
- `circuit.expectCorrectAssert(input)` to test whether the circuit assertions pass for some given input
- `circuit.expectFailedAssert(input)` to test whether the circuit assertions pass for some given input

#### Witnes

What if we would just like to see what the output is, instead of comparing it to some witness? Well, that would be a trouble because we would have to parse the witness array (which is huge for some circuits) with respect to which signals the output signals correspond to. Thankfully, Circomkit has a function for that:

```ts
const output = await circuit.compute(INPUT, ['foo', 'bar']);
/* {
  foo: [[1n, 2n], [3n, 4n]]
  bar: 42n
} */
```

Note that this operation requires parsing the symbols file (`.sym`) and reading the witness array, which may be costly for large circuits. Most of the time, you won't need this for testing; instead, you will likely use it to see what the circuit actually does for debugging.

#### Multiple templates

You will often have multiple templates in your circuit code, and you might want to test them in the same test file of your main circuit too. Well, you can!

```ts
describe('multiplier utilities', () => {
  describe('multiplication gate', () => {
    let circuit: WasmTester<['in'], ['out']>;

    before(async () => {
      circuit = await WasmTester.new(circuitName, {
        file: 'multiplier',
        template: 'MultiplicationGate',
        dir: 'test/multiplier', // nested paths ✔
      });
    });

    it('should pass for in range', async () => {
      await circuit.expectCorrectAssert({in: [7, 5]}, {out: 7 * 5});
    });
  });
});
```

### Proof Verification

If you have created the prover key, verification key & the circuit WASM file (which is simply `yarn keygen <circuit-name> -p <pptau-path>`), you can also test proof generation & verification.

```ts
describe('multiplier proofs', () => {
  let fullProof: FullProof;
  let circuit: ProofTester<['in']>;

  before(async () => {
    circuit = new ProofTester(`multiplier_${N}`);
    fullProof = await circuit.prove({
      in: Array.from({length: N}, () => Math.floor(Math.random() * 100 * N)),
    });
  });

  it('should verify', async () => {
    await circuit.expectVerificationPass(fullProof.proof, fullProof.publicSignals);
  });

  it('should NOT verify', async () => {
    await circuit.expectVerificationFail(fullProof.proof, ['13']);
  });
});
```

The two utility functions provided here are:

- `circuit.expectVerificationPass(proof, publicSignals)` that makes sure that the given proof is **accepted** by the verifier for the given public signals.
- `circuit.expectVerificationFail(proof, publicSignals)` that makes sure that the given proof is **rejected** by the verifier for the given public signals.

## File Structure

The repository follows an _opinionated file structure_ shown below, abstracting away the pathing and orientation behind the scenes. Circomkit handles most of the work with respect to this structure.

```sh
circomkit
├── circuit.config.cjs # configs for circuit main components
├── .cli.env # environment variables for cli
├── circuits # where you write templates
│   ├── main # auto-generated main components
│   │   │── sudoku_9x9.circom # e.g. a 9x9 sudoku board
│   │   └── ...
│   ├── test # auto-generated test components
│   │   └── ...
│   │── sudoku.circom # a generic sudoku circuit template
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
    │   │── example-input # artifacts of an input
    │   │   │── proof.json # generated proof object
    │   │   │── public.json # public signals
    │   │   └── witness.wtns # witness file
    │   │── ... # folders for other inputs
    │   │── sudoku_9x9.r1cs
    │   │── sudoku_9x9.sym
    │   │── prover_key.zkey
    │   └── verification_key.json
    └── ...
```

## Styling

We use [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) for the TypeScript codes.

```bash
# check the formatting
yarn format

# lint everything
yarn lint

# do both at once
yarn style
```
