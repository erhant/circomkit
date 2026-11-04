# Sudoku with Node.js

A Sudoku circuit, proving "I know the solution to this puzzle" without revealing it, tested with [Vitest](https://vitest.dev/). The `puzzle` is a public input, and a zero in it marks a blank cell.

```sh
npm install
npm test        # witness tests & proofs
npm run test:c  # the C witness calculator, see below
```

## Witness tests

[`tests/sudoku.test.ts`](./tests/sudoku.test.ts) instantiates the same template for 4x4 & 9x9 boards, checks that the solution is accepted, and that wrong solutions are rejected: a repeated value in a row, a column or a square, and values out of range. A helper template, `InRange`, is tested on its own.

## Protocols

[`circuits.json`](./circuits.json) has the 4x4 circuit three times, where `sudoku_plonk` & `sudoku_fflonk` override the global protocol of [`circomkit.json`](./circomkit.json):

```json
"sudoku_plonk": {
  "file": "sudoku",
  "template": "Sudoku",
  "pubs": ["puzzle"],
  "params": [2],
  "overrides": {"protocol": "plonk"}
}
```

[`tests/proofs.test.ts`](./tests/proofs.test.ts) proves & verifies with each protocol, using `ProofTester`. Each protocol downloads the PTAU it needs: PLONK & FFLONK need larger ones than Groth16.

## C witness calculator

[`tests/c-witness.test.ts`](./tests/c-witness.test.ts) passes `'c'` to `WitnessTester`, and checks that C & WASM compute the same witness. The C witness calculator can be faster for large circuits. It needs a C++ compiler, `make`, and the GMP & [nlohmann/json](https://github.com/nlohmann/json) libraries. On Debian & Ubuntu:

```sh
sudo apt install build-essential libgmp-dev nlohmann-json3-dev nasm
```

On macOS, with the Xcode command line tools (`xcode-select --install`) and [Homebrew](https://brew.sh):

```sh
brew install gmp nlohmann-json # and nasm on Intel Macs
export CPATH="$(brew --prefix)/include" LIBRARY_PATH="$(brew --prefix)/lib"
```

On machines that are not x86-64, such as Apple Silicon, it needs Circom 2.2.2 or newer.

## CLI

The circuits of [`circuits.json`](./circuits.json) have their default inputs in [`inputs`](./inputs/):

```sh
npx circomkit compile sudoku_9x9
npx circomkit info sudoku_9x9
npx circomkit prove sudoku_9x9           # sets up the circuit first, downloading a PTAU if needed
npx circomkit verify sudoku_9x9
npx circomkit witness sudoku_9x9 --c     # with the C witness calculator

npx circomkit prove sudoku_plonk         # with PLONK
npx circomkit contract sudoku_plonk      # a PLONK verifier contract
```

The circuit comes from the archived [circomkit-examples](https://github.com/erhant/circomkit-examples) repository.
