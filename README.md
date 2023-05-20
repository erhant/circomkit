<p align="center">
  <h1 align="center">
    Circomkit
  </h1>
  <p align="center">A simple-to-use Circom & SnarkJS circuit development & testing environment.</p>
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

- [x] **Programmable Circuits**: Using circuit configs, you can programmatically create the `main` component for a circuit.
- [x] **Simple CLI**: A very easy to use CLI is provided as a wrapper around SnarkJS commands, and they are all provided as `package.json` scripts!
- [x] **Easily Configurable**: Just change the configured proof-system & elliptic curve at [`.cli.env`](./.cli.env) and you are good to go.
- [x] **Witness Testing**: You can test computations & assertions for every template in a circuit, with minimal code-repetition.
- [x] **Proof Testing**: With prover & verification keys and the WASM circuit, you can test proof generation & verification.
- [x] **Simple Outputs**: Easily see the output signals of your circuit, without generating a proof.
- [x] **Type-safe**: Witness & proof testers, as well as circuit signal inputs & outputs are all type-safe via generics.
- [x] **Solidity Exports**: Export a verifier contract in Solidity, or export a calldata for your proofs & public signals.

## Usage

Clone the repository or create a new one with this as the template! You need [Circom](https://docs.circom.io/getting-started/installation/) to compile circuits. Other than that, just `yarn` or `npm install` to get started. It will also install [Circomlib](https://github.com/iden3/circomlib/tree/master/circuits) which has many utility circuits.

The repository follows an _opinionated file structure_ shown below, abstracting away the pathing and orientation behind the scenes. Shell scripts handle most of the work, and they are exposed through a CLI.

Write your circuits under the `circuits` folder; the circuit code itself should be templates only. The main component itself is created automatically via a [script](./utils/instantiate.ts) which uses a simple EJS [template](./circuits/ejs/template.circom) to create the main component. The target circuits are defined under the [circuit configs](./circuit.config.ts) file, such as:

```js
// circuit name is the key
multiplier_3: {
  // file to include for the template
  file: 'multiplier',
  // template to instantiate the main component
  template: 'Multiplier',
  // array of public inputs
  publicInputs: [],
  // template parameters, order is important
  templateParams: [3],
}
```

Use the [CLI](./scripts/cli.sh), or its wrapper scripts in [package.json](./package.json) to do stuff with your circuits. There are also some environment variables that the CLI can make use of, they are written under [.cli.env](./.cli.env) file.

```bash
# Compile the circuit (generates the main component too)
yarn compile circuit-name [-d directory-name (default: main)]

# Circuit setup
yarn setup circuit-name -p phase1-ptau-path [-n num-contribs (default: 1)]

# Shorthand for `compile` and then `setup`
yarn keygen circuit-name -p phase1-ptau-path [-n num-contribs (default: 1)]

# Create a Solidity verifier contract
yarn contract circuit-name

# Clean circuit artifacts
yarn clean circuit-name

# Generate the `main` component without compiling it afterwards
yarn instantiate circuit-name [-d directory-name (default: main)]
```

### Working with Input Signals

Some actions such as generating a witness, generating a proof and verifying a proof require JSON inputs to provide the signal values. For that, we specifically create our input files under the `inputs` folder, and under the target circuit name there. For example, an input named `foobar` for some circuit named `circ` would be at `inputs/circ/foobar.json`.

```bash
# Generate a witness for some input
yarn witness circuit-name -i input-name

# Generate a proof for some input
yarn prove circuit-name -i input-name

# Verify a proof for some input (public signals only)
yarn verify circuit-name -i input-name

# Debug a witness of some input
yarn debug circuit-name -i input-name

# Export calldata to call your Solidity verifier contract
yarn calldata circuit-name -i input-name
```

## Testing

To run tests do the following:

```bash
# test a specific circuit
yarn test "circuit name"

# test all circuits
yarn test:all
```

You can test both witness calculations and proof generation & verification. We describe both in their respective sections, going over an example of "Multiplication" circuit.

### Example Circuits

We have several example circuits to help guide you:

- **Multiplier**: A circuit to prove that you know the factors of a number.
- **Fibonacci**: A circuit to compute Fibonacci numbers, a recursive implementation is given too.
- **Sudoku**: A circuit to prove that you know the solution to a Sudoku puzzle.
- **Floating-Point Addition**: A circuit to compute the sum of two floating-point numbers, adapted from [Berkeley ZKP MOOC 2023 - Lab 1](https://github.com/rdi-berkeley/zkp-mooc-lab).

### Witness Calculation

Witness calculation tests check whether your circuit computes the correct result based on your inputs, and makes sure that assertions are correct. We provide very useful utility functions to help write these tests.

To run a circuit, you need to create a `main` component in Circom, where your main template is assigned to this component. You could do this manually, but in Circomkit we prefer to do this programmatically, using the `instantiate` function. Let us go over an example test for the multiplication circuit.

```ts
import {instantiate} from '../utils/instantiate';
import {WasmTester} from '../utils/wasmTester';

describe('multiplier', () => {
  // templates parameters!
  const N = 3;

  // type-safe signal names!
  let circuit: WasmTester<['in'], ['out']>;

  before(async () => {
    const circuitName = `multiplier_${N}`;
    instantiate(circuitName, {
      file: 'multiplier',
      template: 'Multiplier',
      publicInputs: [],
      templateParams: [N],
    });
    circuit = await WasmTester.new(circuitName);

    // constraint count checks!
    await circuit.checkConstraintCount(N - 1);
  });

  it('should compute correctly', async () => {
    const randomNumbers = Array.from({length: N}, () => Math.floor(Math.random() * 100 * N));

    await circuit.expectCorrectAssert(
      {
        in: randomNumbers,
      },
      {
        out: randomNumbers.reduce((prev, acc) => acc * prev),
      }
    );
  });
});
```

Before tests begin, we must create a circuit tester object, which is what happens in the `before` hook.

1. A `main` component is created with the given configuration.
2. A circuit tester is created from that main component.
3. Constraint count is checked (optional).

With the circuit object, we can do the following:

- `circuit.expectCorrectAssert(input, output)` to test whether we get the expected output for some given input.
- `circuit.expectCorrectAssert(input)` to test whether the circuit assertions pass for some given input
- `circuit.expectFailedAssert(input)` to test whether the circuit assertions pass for some given input

#### Circuit outputs

What if we would just like to see what the output is, instead of comparing it to some witness? Well, that would be a trouble because we would have to parse the witness array (which is huge for some circuits) with respect to which signals the output signals correspond to. Thankfully, Circomkit has a function for that:

```ts
const outputSignals = ['foo', 'bar'];
const output = await circuit.compute(INPUT, outputSignals);
console.log(output);
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
      const circuitName = 'mulgate';
      instantiate(
        circuitName,
        {
          file: 'multiplier',
          template: 'MultiplicationGate',
          publicInputs: [],
          templateParams: [],
        },
        'test/multiplier'
      );
      circuit = await WasmTester.new(circuitName, 'test/multiplier');
    });

    it('should pass for in range', async () => {
      await circuit.expectCorrectAssert(
        {
          in: [7, 5],
        },
        {out: 7 * 5}
      );
    });
  });
});
```

### Proof Verification

If you have created the prover key, verification key & the circuit WASM file, you can also test proof generation & verification.

```ts
describe('multiplier proofs', () => {
  const N = 3;
  let fullProof: FullProof;
  let circuit: ProofTester<['in']>;
  before(async () => {
    const circuitName = 'multiplier_' + N;
    circuit = new ProofTester(circuitName);
    fullProof = await circuit.prove({
      in: Array.from({length: N}, () => Math.floor(Math.random() * 100 * N)),
    });
  });

  it('should verify', async () => {
    await circuit.expectVerificationPass(fullProof.proof, fullProof.publicSignals);
  });

  it('should NOT verify', async () => {
    // just give a prime number as the output, assuming none of the inputs are 1
    await circuit.expectVerificationFail(fullProof.proof, ['13']);
  });
});
```

The two utility functions provided here are:

- `circuit.expectVerificationPass(proof, publicSignals)` that makes sure that the given proof is **accepted** by the verifier for the given public signals.
- `circuit.expectVerificationFail(proof, publicSignals)` that makes sure that the given proof is **rejected** by the verifier for the given public signals.

## File Structure

The underlying file structure is explained below.

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
