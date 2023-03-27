# Circom Starter

> A template repository to write arithmetic circuits.

## Usage

Clone the repository or create a new one with this as the template! You need [Circom](https://docs.circom.io/getting-started/installation/) to compile circuits. Other than that, just `yarn` or `npm install` to get started.

The repository follows an _opinionated file structure_ shown below, abstracting away the pathing and orientation behind the scenes. Shell scripts handle most of the work, and they are exposed through a [CLI](./scripts/main.sh).

```sh
circom-ts-starter
├── circuits  # where you write templates
│   ├── main  # where you instantiate components
│   │   │── foo-main.circom
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
    │── foo-main
    │   │── foo-main_js # artifacts of compilation
    │   │   │── generate_witness.js
    │   │   │── witness_calculator.js
    │   │   └── foo-main.wasm
    │   │── input-name # artifacts of witness & proof generation
    │   │   │── proof.json # proof object
    │   │   │── public.json # public signals
    │   │   └── witness.wtns
    │   │── ... # folders for other inputs
    │   │── foo-main.r1cs
    │   │── foo-main.sym
    │   │── prover_key.zkey
    │   └── verification_key.json
    └── ...
```

Write your circuits under `circuits` folder. The circuit code itself should be templates only. You should only create the main component under `circuits/main` folder.

Use the [CLI](./scripts/cli.sh), or its wrapper scripts in [package.json](./package.json) to do stuff with your circuits.

```bash
yarn compile -c circuit-name
yarn clean   -c circuit-name
yarn type    -c circuit-name
yarn ptau    -c circuit-name -n num-contribs -p phase1-ptau-path
yarn prove   -c circuit-name -i input-name
yarn verify  -c circuit-name -i input-name
```

There are some environment variables that the CLI can make use of, they are written under [.cli.env](./.cli.env) file.

## Testing

To run tests:

```bash
# run all tests
yarn test
# run a specific test
yarn --grep "circuit name"
```

Within each test, there are two sub-tests:

- **Witness Computation** will test whether witness computations are matching the expectations & the constraints hold.
- **Proof Validation** will test whether proof generation & verification works correctly. This requires the **WASM file**, **prover key**, and **verification key** to be calculated beforehand.
