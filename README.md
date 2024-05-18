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
- [x] Provides type-safe testing utilities to check for circuit computations & soundness errors, with minimal boilerplate code!
- [x] Supports all protocols: `groth16`, `plonk`, and `fflonk`.
- [x] Automatically downloads phase-1 PTAU when using `bn128`.
- [x] Supports multiple exports such as a Solidity verifier contract and its calldata for some input, or JSON exports for R1CS and the witness file.

## Installation

Circomkit can be installed via:

```sh
npm  install circomkit
pnpm install circomkit
yarn add     circomkit
bun  add     circomkit
```

You will also need [Circom](https://docs.circom.io), which can be installed following the instructions [here](https://docs.circom.io/getting-started/installation/).

## Usage

You can see available commands with:

```sh
npx circomkit help
```

You can check out examples at the [circomkit-examples](https://github.com/erhant/circomkit-examples) repository.

### Command Line Interface

Actions that require a circuit name can be called as follows:

```sh
# Compile the circuit
npx circomkit compile <circuit>

# Create the main component
npx circomkit instantiate <circuit>

# Create a Solidity verifier contract
npx circomkit contract <circuit>

# Clean circuit artifacts
npx circomkit clean <circuit>

# Circuit-specific setup
npx circomkit setup <circuit> [ptau-path]

# Create verification key
npx circomkit vkey <circuit> [pkey-path]

# Automatically download PTAU (for BN128)
npx circomkit ptau <circuit>
```

> [!NOTE]
>
> Circuit-specific setup optionally takes the path to a PTAU file as argument. If not provided, it will automatically decide the PTAU to use with respect to constraint count, and download that for you! This feature only works for `bn128` prime, and has an upper-limit of at most $2^{28}$ constraints.

Some actions such as generating a witness, generating a proof and verifying a proof require JSON inputs to provide the signal values. For that, we specifically create our input files under the `inputs` folder, and under the target circuit name there. For example, an input named `foo` for some circuit named `bar` would be at `inputs/bar/foo.json`.

```sh
# Generate a witness
npx circomkit witness <circuit> <input>

# Generate a proof
npx circomkit prove <circuit> <input>

# Verify a proof with public signals
npx circomkit verify <circuit> <input>

# Export Solidity calldata to console
npx circomkit calldata <circuit> <input>
```

### Circomkit Configurations

Everything used by Circomkit can be optionally overridden by providing the selected fields in its constructor. Circomkit CLI does this automatically by checking out `circomkit.json` and overriding the defaults with that. You can print the active configuration via the following command:

```sh
npx circomkit config
```

You can edit any of the fields there to fit your needs. Most importantly, you can change the protocol to be `groth16`, `plonk` or `fflonk`; and you can change the underlying prime field to `bn128`, `bls12381` and `goldilocks`.

> [!NOTE]
>
> Using a prime other than `bn128` makes things a bit harder in circuit-specific setup, as you will have to find the PTAU files yourself, whereas in `bn128` we can use [Perpetual Powers of Tau](https://github.com/privacy-scaling-explorations/perpetualpowersoftau).

### Circuit Configurations

A circuit config within `circuits.json` looks like below, where the `key` is the circuit name to be used in commands, and the value is an object that describes the filename, template name, public signals and template parameters:

```js
sudoku_9x9: {
  file:     'sudoku',
  template: 'Sudoku',
  pubs:     ['puzzle'],
  params:   [3], // sqrt(9)
}
```

> [!TIP]
>
> The `pubs` and `params` options can be omitted, in which case they will default to `[]`.

### Using Circomkit in Code

All CLI commands other than `init` can be used with the same name and arguments within Circomkit. Furthermore, you can provide configuration & inputs directly, instead of letting Circomkit read from `circuits.json` or from within the `inputs` folder.

```ts
import {Circomkit} from 'circomkit';

const circomkit = new Circomkit({
  // custom configurations
  protocol: 'plonk',
});

// artifacts output at `build/multiplier_3` directory
await circomkit.compile('multiplier_3', {
  file: 'multiplier',
  template: 'Multiplier',
  params: [3],
});

// proof & public signals at `build/multiplier_3/my_input` directory
await circomkit.prove('multiplier_3', 'my_input', {in: [3, 5, 7]});

// verify with proof & public signals at `build/multiplier_3/my_input`
await circomkit.verify('multiplier_3', 'my_input');
```

## Writing Tests

Circomkit provides two tester utilities that use Chai assertions within, which may be used in a test suite such as Mocha. The key point of these utilities is to help reduce boilerplate code and let you simply worry about the inputs and outputs of a circuit.

### Witness Tester

The Witness tester extends `require('circom_tester').wasm` tool with type-safety and few assertion functions. It provides a very simple interface:

- `expectPass(input)` checks if constraints & assertions are passing for an input
- `expectPass(input, output)` additionally checks if the outputs are matching
- `expectFail(input)` checks if any constraints / assertions are failing

See an example below:

```ts
describe('witness tester', () => {
  // input signals and output signals can be given as type parameters
  // this makes all functions type-safe!
  let circuit: WitnessTester<['in'], ['out']>;

  beforeAll(async () => {
    const circomkit = new Circomkit();
    circuit = await circomkit.WitnessTester(CIRCUIT_NAME, CIRCUIT_CONFIG);
  });

  it('should pass on correct input & output', async () => {
    await circuit.expectPass(INPUT, OUTPUT);
  });

  it('should fail on wrong output', async () => {
    await circuit.expectFail(INPUT, WRONG_OUTPUT);
  });

  it('should fail on bad input', async () => {
    await circuit.expectFail(BAD_INPUT);
  });
});
```

You can check if the number of constraints are correct using `expectConstraintCount`, as shown below:

```ts
it('should have correct number of constraints', async () => {
  // expects at least N constraints
  await circuit.expectConstraintCount(N);
  // expects exactly N constraints
  await circuit.expectConstraintCount(N, true);
});
```

If you want more control over the output signals, you can use the `compute` function. It takes in an input, and an array of output signal names used in the `main` component so that they can be extracted from the witness.

```ts
it('should compute correctly', async () => {
  const output = await circuit.compute(INPUT, ['out']);
  expect(output).to.haveOwnProperty('out');
  expect(output.out).to.eq(BigInt(OUTPUT.out));
});
```

Finally, you can run tests on the witnesses too. This is most useful when you would like to check for soundness errors.

- `expectConstraintPass(witness)` checks if constraints are passing for a witness
- `expectConstraintFail(witness)` checks if constraints are failing

You can compute the witness via the `calculateWitness(input)` function. To test for soundness errors, you may edit the witness and see if constraints are failing.

> <picture>
>   <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Mqxx/GitHub-Markdown/main/blockquotes/badge/light-theme/tip.svg">
>   <img alt="Warning" src="https://raw.githubusercontent.com/Mqxx/GitHub-Markdown/main/blockquotes/badge/dark-theme/tip.svg">
> </picture><br>
>
> Circomkit provides a nice utility for this purpose, called `editWitness(witness, symbols)`. You simply provide a dictionary of symbols to their new values, and it will edit the witness accordingly. See the example below:
>
> ```ts
> it('should pass on correct witness', async () => {
>   const witness = await circuit.calculateWitness(INPUT);
>   await circuit.expectConstraintPass(witness);
> });
>
> it('should fail on fake witness', async () => {
>   const witness = await circuit.calculateWitness(INPUT);
>   const badWitness = await circuit.editWitness(witness, {
>     'main.signal': BigInt(1234),
>     'main.component.signal': BigInt('0xCAFE'),
>     'main.foo.bar[0]': BigInt('0b0101'),
>   });
>   await circuit.expectConstraintFail(badWitness);
> });
> ```

### Proof Tester

As an alternative to simulate generating a proof and verifying it, you can use Proof Tester. The proof tester makes use of WASM file, prover key and verifier key in the background. It will use the underlying Circomkit configuration to look for those files, and it can generate them automatically if they do not exist. An example using Plonk protocol is given below. Notice how we create the necessary files before creating the tester, as they are required for proof generation and verification.

```ts
describe('proof tester', () => {
  // input signals and output signals can be given as type parameters
  // this makes all functions type-safe!
  let circuit: ProofTester<['in']>;

  beforeAll(async () => {
    const circomkit = new Circomkit({
      protocol: 'plonk',
    });
    circomkit.instantiate(CIRCUIT_NAME, CIRCUIT_CONFIG);
    await circomkit.setup(CIRCUIT_NAME, PTAU_PATH);
    circuit = await circomkit.ProofTester(CIRCUIT_NAME);
  });

  it('should verify a proof correctly', async () => {
    const {proof, publicSignals} = await circuit.prove(INPUT);
    await circuit.expectPass(proof, publicSignals);
  });

  it('should NOT verify a proof with invalid public signals', async () => {
    const {proof} = await circuit.prove(INPUT);
    await circuit.expectFail(proof, BAD_PUBLIC_SIGNALS);
  });
});
```

### Type-Safety

You may notice that there are optional template parameters in both testers: `WitnessTester<InputSignals, OutputSignals>` and `ProofTester<InputSignals>`. These template parameters take in an array of strings corresponding to signal names. For example, if your circuit has two input signals `in1, in2` and an output `out`, you may instantiate the tester as `WitnessTester<['in1', 'in2'], ['out']>`. In doing so, you will get type-checking on all inputs and outputs required by the tester.

## File Structure

Circomkit with its default configuration follows an _opinionated file structure_, abstracting away the pathing and orientation behind the scenes. All of these can be customized by overriding the respective settings in `circomkit.json`.

An example structure is shown below. Suppose there is a generic circuit for a Sudoku solution knowledge proof written under `circuits` folder. When instantiated, a `main` component for a 9x9 board is created under `circuits/main`. The solution along with it's puzzle is stored as a JSON object under `inputs/sudoku_9x9`. You can see the respective artifacts under `build` directory. In particular, we see `groth16` prefix on some files, indicating that Groth16 protocol was used to create them.

```sh
circomkit
├── circuits.json
├── circomkit.json
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
│   └── powersOfTau28_hez_final_08.ptau
│
└── build
    └── sudoku_9x9
        ├── sudoku_9x9_js
        │   │── generate_witness.js
        │   │── witness_calculator.js
        │   └── sudoku_9x9.wasm
        │
        ├── my_solution
        │   │── proof.json
        │   │── public.json
        │   └── witness.wtns
        │
        ├── sudoku_9x9.r1cs
        ├── sudoku_9x9.sym
        │
        ├── groth16_pkey.zkey
        ├── groth16_vkey.json
        └── groth16_verifier.sol

```

## Testing

Run all tests via:

```sh
pnpm test
```

> [!TIP]
>
> You can also use the CLI while developing Circomkit locally via `pnpm cli` as if you are using `npx circomkit`. This is useful for hands-on testing stuff.

## Styling

Circomkit uses [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html).

```sh
# check the formatting
pnpm format

# lint everything
pnpm lint
```

## Acknowledgements

We wholeheartedly thank [BuidlGuild](https://buidlguidl.com/) & [Austin Griffith](https://twitter.com/austingriffith) for providing Circomkit with an [Ecosystem Impact Grant](https://grants.buidlguidl.com/)!
