# Circom + TypeScript Starter

A template repository to write arithmetic circuits.

## Installation

Clone the repository or create a new one with this as the template! You need [Circom](https://docs.circom.io/getting-started/installation/) to compile circuits. Other than that, just `yarn` or `npm install` to get started.

## Usage

You write your circuits under `circuits` folder, as simple as that. Tests and scripts are written in TypeScript. Note that almost all of Circom packages are untyped, so you gotta `require()` them instead of import and stuff. I have some helper Shell scripts to ease the rest of the process, you can see them under `scripts` folder. You might need to do `chmod +x ./scripts/*` to make sure they are executable.

`./scripts/test.sh <circuit-name> <input-name>` will run the entire flow in a single script, and finish with a successful proof verification. It will look for the circuit under `circuits/<circuit-name>` and for a JSON input at `./inputs/<circuit-name>/<input-name>.json`.

If you want to have more control over the flow, such as different number of contributions on different powers-of-tau ceremonies, you can use these scripts. As an example, suppose you have a circuit `foobar.circom`. Here is the entire workflow from compiling the circuit to verifying a proof:

1. , you compile the circuit to generate `js` and `wasm` files. These will be generated under `build/foobar`.

```sh
# args: <circuit-name>
./scripts/compile.sh foobar
```

2. Next, we will do the circuit-specific setup, that is phase-2 of powers-of-tau ceremony. For the phase-1 ceremony, we are using [Perpetual Powers-of-Tau Phase-1](https://github.com/privacy-scaling-explorations/perpetualpowersoftau), the `ptau` file from this is stored under the `ptau` folder. Simply:

```sh
# args: <circuit-name> <num-contributions>
./scripts/ptau-phase2.sh foobar 3`
```

For each contribution, you are expected to provide some entropy via command line.

3. It is time to create a witness, i.e. providing our knowledge of some private input. Write you inputs under `inputs/foobar` folder. Say you wrote `dummy.json` with some inputs. You can create a witness for this input via the following:

```sh
# args: <circuit-name> <witness-name>
./scripts/witness.sh foobar dummy
```

This will create a witness `dummy_witness.wtns` under `build/foobar`.

4. To generate a proof, simply provide the circuit name and witness name, along with the ID of zkey you want to use:

```sh
# args: <circuit-name> <witness-name>
./scripts/prove.sh foobar dummy
```

5. To verify, just provide the circuit and input names:

```sh
# args: <circuit-name> <witness-name>
./scripts/verify.sh foobar dummy
```

The script will automatically look for `dummy_public.json` and `dummy_proof.json` and run the verification process.

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
