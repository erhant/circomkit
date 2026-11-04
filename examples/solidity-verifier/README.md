# Solidity Verifier

A Groth16 verifier contract, exported by Circomkit and tested with [Foundry](https://getfoundry.sh/) against a proof from Circomkit.

```sh
npm install
npm test
```

`npm test` runs the following, then `forge test`:

```sh
npx circomkit prove multiplier_3     # reads inputs/multiplier_3.json, writes build/multiplier_3/default/groth16_proof.json & public.json
npx circomkit contract multiplier_3  # writes build/multiplier_3/groth16_verifier.sol
```

[The test](./test/Verifier.t.sol) reads the proof & public signals with Foundry's JSON cheatcodes, and calls the verifier. Note that the contract takes the coordinates of `pi_b` in reverse order.

To call a deployed verifier with `cast` instead, print the calldata with:

```sh
npx circomkit calldata multiplier_3
```

[forge-std](https://github.com/foundry-rs/forge-std) is installed with npm, so that there are no git submodules.
