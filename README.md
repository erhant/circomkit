# Circom Starter

A template repository to write arithmetic circuits.

## Usage

Clone the repository or create a new one with this as the template! You need [Circom](https://docs.circom.io/getting-started/installation/) to compile circuits. Other than that, just `yarn` or `npm install` to get started.

The repository follows an _opinionated file structure_ shown below, abstracting away the pathing and orientation behind the scenes. Shell scripts handle most of the work, and they are exposed through a [CLI](./scripts/main.sh).

```sh
circom-ts-starter
├── circuits  # where you write templates
│   ├── main  # where you instantiate components
│   │   │── foo-bar.circom
│   │   └── ...
│   │── foo.circom
│   └── ...
├── inputs    # where you write JSON inputs per circuit
│   ├── foo
│   │   ├── input-name.json
│   │   └── ...
│   └── ...
├── ptau      # universal phase-1 setups
│   ├── powersOfTau28_hez_final_12.ptau
│   └── ...
└── build     # artifacts, .gitignore'd
    │── foo-bar
    │   │── foo-bar_js # artifacts of compilation
    │   │   │── generate_witness.js
    │   │   │── witness_calculator.js
    │   │   └── foo-bar.wasm
    │   │── input-name # artifacts of witness & proof generation
    │   │   │── proof.json # proof object
    │   │   │── public.json # public signals
    │   │   └── witness.wtns
    │   │── ... # folders for other inputs
    │   │── foo-bar.r1cs
    │   │── foo-bar.sym
    │   │── prover_key.zkey
    │   └── verification_key.json
    └── ...
```

Write your circuits under `circuits` folder. The circuit code itself should be templates only. You should only create the main component under `circuits/main` folder.

Use the [CLI](./scripts/cli.sh), or its wrapper scripts in [package.json](./package.json) to do stuff with your circuits.

```bash
# yarn cli:function ==> ./scripts/cli.sh -f function
yarn cli:compile -c circuit-name
yarn cli:clean   -c circuit-name
yarn cli:ptau    -c circuit-name -n num-contribs -p phase1-ptau-path
yarn cli:prove   -c circuit-name -i input-name
yarn cli:verify  -c circuit-name -i input-name
```

## Testing

Just `yarn test`. Each test is named w.r.t the circuit that they are testing, so you can test a specific circuit via `--grep <circuit-name>` option. Within each test, there are two sub-tests:

- **Functionality** will test whether witness computations are matching the expectations. It uses `circom_tester`.
- **Validation** will test whether verification works correctly. This requires the **WASM file**, **prover key**, and **verification key** to be calculated beforehand.

## File Structure

- **circuits**: Circom circuits are stored here.
- **inputs**: JSON file(s) for each circuit, used for witness generation.
- **scripts**: Generic shell scripts for compiling, proving, verifying, witnessing, and powers-of-tau ceremonies. This is mostly for local development usage.
- **test**: Mocha tests for circuits.

It is worth mentioning the internal file structure respected by all scripts here. Suppose you have a circuit called `foobar` and you have an input called `default`.

- Your circuit should be located at `circuits/foobar.circom`.
- Your input should be located at `inputs/foobar/default.json`.

When you do the entire workflow described above (or simply call `scripts/test.sh foobar default`) then you should expect the following:

- A directory called `build/foobar` will be created.
  - `build/foobar/foobar_js` will have the witness generation codes and the WASM circuit.
  - `build/foobar/prover_key.zkey` is the prover key.
  - `build/foobar/verification_key.json` is the verification key.
  - `build/foobar/foobar.r1cs` is the Rank-1 Constraint System output for this circuit.
- For each input, there will be a proof, public signals, and a witness. Following the example of an input called `default`, these are stored as follows:
  - `build/foobar/default/proof.json` has the proof.
  - `build/foobar/default/public.json` has the public signals. This is used by the verifier script, if you change the public signals to be wrong, the verification will fail.
  - `build/foobar/default/witness.wtns` has the witness.

## Resources

- Many Circom test codes I have seen were rather clunky, but this one seems to be the most clear: <https://github.com/0xPARC/circom-starter>.
- <https://github.com/vocdoni/zk-franchise-proof-circuit/blob/master/test/lib.test.ts> has some Poseidon action.
- <https://github.com/rdi-berkeley/zkp-course-lecture3-code/blob/main/circom/Makefile> has a neat Makefile to make the entire thing done with a single `make`. Will refactor this a bit.
