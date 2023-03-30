# Circom Starter

> A template repository to write arithmetic circuits.

## Usage

Clone the repository or create a new one with this as the template! You need [Circom](https://docs.circom.io/getting-started/installation/) to compile circuits. Other than that, just `yarn` or `npm install` to get started.

The repository follows an _opinionated file structure_ shown below, abstracting away the pathing and orientation behind the scenes. Shell scripts handle most of the work, and they are exposed through a [CLI](./scripts/main.sh).

```sh
circom-ts-starter
├── circuit.config.cjs # configs for circuit main components
├── .cli.env # environment variables for cli
├── circuits # where you write templates
│   ├── main # where you instantiate components
│   │   │── foo-main.circom
│   │   └── ...
│   │── foo.circom
│   └── ...
├── inputs # where you write JSON inputs per circuit
│   ├── foo
│   │   ├── input-name.json
│   │   └── ...
│   └── ...
├── ptau # universal phase-1 setups
│   ├── powersOfTau28_hez_final_12.ptau
│   └── ...
└── build # artifacts, .gitignore'd
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

Write your circuits under `circuits` folder; the circuit code itself should be templates only. The main component itself is created automatically via a [script](./scripts/instantiate.js) which uses a simple EJS [template](./circuits/main/_template.circom) to create the main component. The target circuits are defined under the [circuit configs](./circuit.config.cjs) file, such as:

```js
multiplier3: {
  template: 'Multiplier', // template to instantiate the main component
  file: 'multiplier', // file to include for the template
  publicInputs: [], // array of public inputs
  templateInputs: [3], // template parameters, order is important
}
```

Use the [CLI](./scripts/cli.sh), or its wrapper scripts in [package.json](./package.json) to do stuff with your circuits.

```bash
yarn compile -c circuit-name
yarn clean   -c circuit-name
yarn ptau    -c circuit-name -n num-contribs -p phase1-ptau-path
yarn prove   -c circuit-name -i input-name
yarn verify  -c circuit-name -i input-name
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

The code uses Google TypeScript Style guide. It also has some folder & file icon overrides for several Material UI icons to make things look better.
