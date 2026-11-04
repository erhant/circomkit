# C Witness Calculator

A chain of Poseidon hashes from [`circomlib`](https://github.com/iden3/circomlib), with its witness calculated in C & WASM. The C witness calculator can be faster for large circuits.

It needs a C++ compiler, `make`, and the GMP & [nlohmann/json](https://github.com/nlohmann/json) libraries. On Debian & Ubuntu:

```sh
sudo apt install build-essential libgmp-dev nlohmann-json3-dev nasm
```

On macOS, with the Xcode command line tools (`xcode-select --install`) and [Homebrew](https://brew.sh):

```sh
brew install gmp nlohmann-json # and nasm on Intel Macs
export CPATH="$(brew --prefix)/include" LIBRARY_PATH="$(brew --prefix)/lib"
```

On machines that are not x86-64, such as Apple Silicon, it needs Circom 2.2.2 or newer.

[The tests](./tests/poseidon.test.ts) pass `'c'` to `WitnessTester`, and check that C & WASM compute the same witness:

```sh
npm install
npm test
```

[`circomkit.json`](./circomkit.json) sets `cWitness: true`, so the CLI builds the C witness calculator too, and can use it with `--c`:

```sh
npx circomkit compile poseidon_2
npx circomkit witness poseidon_2 --c
```
