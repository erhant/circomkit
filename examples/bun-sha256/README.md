# SHA-256 with Bun & Solidity

The [SHA-256](https://en.wikipedia.org/wiki/SHA-2) circuit of [`circomlib`](https://github.com/iden3/circomlib), proving "I know the preimage of this digest", with [Bun](https://bun.sh/), and a Solidity verifier tested with [Foundry](https://getfoundry.sh/).

```sh
bun install
bun start         # compiles, proves & verifies from code
bun test          # witness tests
bun run test:sol  # the Solidity verifier, needs Foundry
```

## Proving from code

[`src/index.ts`](./src/index.ts) compiles the circuit, computes a witness, proves & verifies, with the Circomkit API.

## Witness tests

[`tests/sha256.test.ts`](./tests/sha256.test.ts) checks the digest against Node's `crypto`, and that a fake witness, edited deep within the SHA-256 compression, does not satisfy the constraints.

## Solidity verifier

`bun run test:sol` runs the following, then `forge test`:

```sh
bunx circomkit prove sha256_32     # reads inputs/sha256_32.json, writes build/sha256_32/default/groth16_proof.json & public.json
bunx circomkit contract sha256_32  # writes build/sha256_32/groth16_verifier.sol
```

[`contracts/Verifier.t.sol`](./contracts/Verifier.t.sol) reads the proof & public signals with Foundry's JSON cheatcodes and calls the verifier. Note that the contract takes the coordinates of `pi_b` in reverse order. It also checks that the public signals, the bytes of the digest, are what Solidity's `sha256` computes for the input.

To call a deployed verifier yourself, print the arguments of `verifyProof` with the command below. Each value is quoted, so remove the quotes for `cast`.

```sh
bunx circomkit calldata sha256_32
```

[forge-std](https://github.com/foundry-rs/forge-std) is installed as a package, so that there are no git submodules.

## CLI

With `bunx` instead of `npx`, the CLI runs with Bun too:

```sh
bunx circomkit compile sha256_32
bunx circomkit prove sha256_32
bunx circomkit verify sha256_32
```
