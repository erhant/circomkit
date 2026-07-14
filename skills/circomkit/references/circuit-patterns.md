# Circuit patterns

A catalog of common, reusable Circom patterns. Prefer circomlib implementations
where they exist; the sketches here show the *shape* so you understand what the
constraints are doing. Adapted from the circom101 book
(<https://github.com/erhant/circom101>).

## Table of contents

- [Equality and zero](#equality-and-zero)
- [Bits and range checks](#bits-and-range-checks)
- [Comparisons](#comparisons)
- [Selection (mux) and conditionals](#selection-mux-and-conditionals)
- [Booleans and logic gates](#booleans-and-logic-gates)
- [Membership and distinctness](#membership-and-distinctness)
- [Hashing and commitments](#hashing-and-commitments)
- [Merkle proofs](#merkle-proofs)

## Equality and zero

`IsZero` (see SKILL.md for the full sound version) outputs 1 iff `in == 0`.
`IsEqual(a, b)` is `IsZero(a - b)`:

```circom
template IsEqual() {
    signal input in[2];
    signal output out;
    component isz = IsZero();
    isz.in <== in[1] - in[0];
    out <== isz.out;
}
```

Use circomlib's `IsZero` / `IsEqual` in practice.

## Bits and range checks

`Num2Bits(n)` decomposes a number into `n` bits and, crucially, **constrains**
each output to be a bit and the recomposition to equal the input — this is what
makes it a real range check (proves `in < 2^n`):

```circom
template Num2Bits(n) {
    signal input in;
    signal output out[n];
    var acc = 0;
    var pow = 1;
    for (var i = 0; i < n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] - 1) === 0;   // each out[i] is 0 or 1
        acc += out[i] * pow;
        pow *= 2;
    }
    acc === in;                        // recomposition ties it down
}
```

`Bits2Num(n)` is the inverse. To assert `x` fits in N bits, just instantiate
`Num2Bits(N)` on it.

## Comparisons

The field has no native ordering, so comparison = bit decomposition. `LessThan(n)`
compares two `n`-bit numbers by checking the top bit of `a - b + 2^n`:

```circom
template LessThan(n) {
    signal input in[2];
    signal output out;
    component n2b = Num2Bits(n + 1);
    n2b.in <== in[0] + (1 << n) - in[1];
    out <== 1 - n2b.out[n];
}
```

Both inputs must be known to fit in `n` bits (range-check them first if they come
from untrusted inputs). Use circomlib's `LessThan`, `LessEqThan`, `GreaterThan`.

## Selection (mux) and conditionals

You cannot branch on a signal with `if`. Select with a mux, where `sel` is
constrained to be a bit:

```circom
// out = sel ? b : a
template Mux1() {
    signal input a, b, sel;
    signal output out;
    sel * (sel - 1) === 0;             // sel is a bit
    out <== a + sel * (b - a);
}
```

circomlib provides `Mux1`..`Mux4` for wider selectors.

## Booleans and logic gates

Represent booleans as bit-constrained signals (`b * (b - 1) === 0`). Then:

```circom
// AND, OR, XOR, NOT of bits a, b
and <== a * b;
or  <== a + b - a * b;
xor <== a + b - 2 * a * b;
not <== 1 - a;
```

## Membership and distinctness

- **Is-equal-to-any**: OR together `IsEqual` results against a set.
- **All-distinct**: for every pair `(i, j)`, assert `IsZero(a[i] - a[j]).out == 0`.
  Cost is O(k²) in the set size; fine for small sets (Sudoku, small lists).

## Hashing and commitments

Use a circuit-friendly hash — `Poseidon` (preferred) or `MiMC` from circomlib —
never SHA/Keccak inside a circuit unless required, as they are enormous in
constraints. A commitment is typically `Poseidon(secret, salt)`; the circuit
recomputes it from private inputs and constrains it to equal a public value.

```circom
component h = Poseidon(2);
h.inputs[0] <== secret;
h.inputs[1] <== salt;
h.out === commitment;      // commitment is a public input
```

## Merkle proofs

A Merkle inclusion proof hashes a leaf up a path of siblings, selecting
left/right order by the path bit at each level, and constrains the final hash to
equal the public root:

```circom
template MerkleProof(depth) {
    signal input leaf;
    signal input siblings[depth];
    signal input pathBits[depth];      // 0 = we're the left child, 1 = right
    signal input root;

    signal cur[depth + 1];
    cur[0] <== leaf;
    component h[depth];
    for (var i = 0; i < depth; i++) {
        pathBits[i] * (pathBits[i] - 1) === 0;
        // order the two inputs by pathBits[i] using muxes
        signal left  <== cur[i] + pathBits[i] * (siblings[i] - cur[i]);
        signal right <== siblings[i] + pathBits[i] * (cur[i] - siblings[i]);
        h[i] = Poseidon(2);
        h[i].inputs[0] <== left;
        h[i].inputs[1] <== right;
        cur[i + 1] <== h[i].out;
    }
    cur[depth] === root;
}
```

See the circom101 Merkle-trees chapter for binary/incremental/sparse variants.
