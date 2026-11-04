# Testing

Witness tests with [Vitest](https://vitest.dev/), each file a recipe:

- [multiplier](./tests/multiplier.test.ts): expected outputs, failing inputs, constraint counts & readable constraints, and testing a template on its own.
- [fibonacci](./tests/fibonacci.test.ts): comparing the constraints of two templates, and reading intermediate signals, which needs optimization level 0 for this circuit.
- [sudoku](./tests/sudoku.test.ts): one template for several parameters, public inputs, and inputs that must be rejected.
- [soundness](./tests/soundness.test.ts): finding an under-constrained circuit, by editing a witness as a malicious prover would.

```sh
npm install
npm test
```

The same circuits are configured in [`circuits.json`](./circuits.json) for the CLI, with inputs in [`inputs`](./inputs/):

```sh
npx circomkit compile sudoku_9x9
npx circomkit info sudoku_9x9
npx circomkit prove sudoku_9x9   # sets up the circuit first, downloading a PTAU if needed
npx circomkit verify sudoku_9x9
```

The circuits come from the archived [circomkit-examples](https://github.com/erhant/circomkit-examples) repository.
