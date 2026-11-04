# Protocols

A 4x4 Sudoku circuit proven with Groth16, PLONK & FFLONK. [`circuits.json`](./circuits.json) has the same circuit three times, where `sudoku_plonk` & `sudoku_fflonk` override the global protocol of [`circomkit.json`](./circomkit.json):

```json
"sudoku_plonk": {
  "file": "sudoku",
  "template": "Sudoku",
  "pubs": ["puzzle"],
  "params": [2],
  "overrides": {"protocol": "plonk"}
}
```

[The tests](./tests/proofs.test.ts) prove & verify with each protocol, using `ProofTester`. Each protocol downloads the PTAU it needs: PLONK & FFLONK need larger ones than Groth16.

```sh
npm install
npm test
```

With the CLI:

```sh
npx circomkit prove sudoku_plonk
npx circomkit verify sudoku_plonk
npx circomkit contract sudoku_plonk   # a PLONK verifier contract
```
