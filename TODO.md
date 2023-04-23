# TODOs

The two features in plan right now is the following:

- [ ] **Multiple Backends**: We only use WASM & SnarkJS right now, but we would like to export prover libraries for other backends such as mobile.
- [ ] **Type Generation**: Generate input & output signal type declarations for a given circuit, [work in progress](./scripts/functions/type.sh).

## Multiple Backends

The default code generates a WASM circuit and does tests in NodeJS environment. We would like to have an easy guide to show how proof generation can be done on other backends for a given circuit too.

Some resources on this:

- [iden3 Rapidsnark](https://github.com/iden3/go-rapidsnark) computes witness, generates & verifies proofs in Go.
- [polygonId witnesscalc](https://github.com/0xPolygonID/witnesscalc) has witness computation build files for many backends.

## Type Generation

We would like to generate types from input and output signals. For example,

```c
template Multiplier(N) {
  signal input in[N];
  signal output out;
  // ...
}
```

could have input and output signals as

```ts
type inputs = {
  in: Array<bigint>;
};
type outputs = {
  out: bigint;
};
```

We could ignore the input size (`in` array should precisely have `N` elements for the example above) because the array size can be computed at runtime within Circom, which makes things a lot more complicated.

Our `type` script almost does the job, but so far I couldn't find a good way to determine the output signal itself, or ignore intermediate signals.
