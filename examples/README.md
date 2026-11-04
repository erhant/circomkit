# Examples

Each example is a cookbook for one topic. They are small, self-contained projects that you can copy as they are and run:

| Example                                   | Shows                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| [testing](./testing/)                     | Witness tests with Vitest: outputs, failures, constraints, intermediate signals & soundness. |
| [protocols](./protocols/)                 | The same circuit proven with Groth16, PLONK & FFLONK, with per-circuit overrides.            |
| [c-witness](./c-witness/)                 | The C witness calculator, in tests & in the CLI.                                             |
| [solidity-verifier](./solidity-verifier/) | A verifier contract tested with Foundry, against a proof from Circomkit.                     |
| [bun-sha256](./bun-sha256/)               | Circomkit with Bun, using a circuit from `circomlib`.                                        |

All of them need [Circom](https://docs.circom.io/getting-started/installation/), and each lists anything else it needs. Install the dependencies with `npm install` (or the package manager of your choice), then run the tests with `npm test`.
