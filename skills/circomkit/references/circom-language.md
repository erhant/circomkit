# Circom language reference

Depth beyond the essentials in SKILL.md. Circom 2.x. For the official spec see
<https://docs.circom.io>.

## Table of contents

- [Signals and the field](#signals-and-the-field)
- [Operators recap](#operators-recap)
- [Templates, parameters, components](#templates-parameters-components)
- [Arrays](#arrays)
- [Control flow and var](#control-flow-and-var)
- [Functions](#functions)
- [Includes and circomlib](#includes-and-circomlib)
- [Tags](#tags)
- [Anonymous components and tuples](#anonymous-components-and-tuples)
- [Custom templates](#custom-templates)
- [assert and log](#assert-and-log)
- [Gotchas](#gotchas)

## Signals and the field

Signals hold elements of a prime field (the curve's scalar field; bn128 by
default, ~254 bits). There is no overflow error — arithmetic is mod p, and
`-1` is `p - 1`. This is why comparisons and range checks require decomposing a
number into bits: the field has no native `<`.

- `signal input x;` — private input (unless listed in the main component's
  `public`).
- `signal output y;` — always public.
- `signal t;` — intermediate/internal.
- A signal is assigned **once** and is immutable thereafter.
- Signal values must be known/derivable at witness-generation time.

## Operators recap

| Operator | Meaning |
|----------|---------|
| `<==` / `==>` | assign a signal **and** add the constraint (directional sugar) |
| `<--` / `-->` | assign a signal **without** a constraint (must be pinned by `===`) |
| `===` | add a constraint, no assignment |
| `=` | assign a `var` (compile-time only) |

Constraints must be **quadratic** (≤ one signal×signal multiplication). Split
higher degrees with intermediate signals.

## Templates, parameters, components

A `template` defines a reusable circuit. Parameters in parentheses are
compile-time constants (they shape the circuit, e.g. array sizes / loop counts),
distinct from signals.

```circom
template Multiplier(n) {          // n is a compile-time parameter
    assert(n > 1);
    signal input in[n];
    signal output out;
    signal inner[n - 1];
    inner[0] <== in[0] * in[1];
    for (var i = 2; i < n; i++) {
        inner[i - 1] <== inner[i - 2] * in[i];
    }
    out <== inner[n - 2];
}
```

Instantiate other templates as components:

```circom
component isz = IsZero();
isz.in <== x;
y <== isz.out;
```

Arrays of components are common for per-element logic:

```circom
component isZero[n];
for (var i = 0; i < n; i++) {
    isZero[i] = IsZero();
    isZero[i].in <== in[i] - 1;
    isZero[i].out === 0;
}
```

## Arrays

Signals and vars can be multi-dimensional. Dimensions are compile-time
expressions (may use parameters): `signal input board[9][9];`,
`signal input in2D[N][M];`. Array assignment with `<==` works element-wise for
same-shaped arrays.

## Control flow and var

`var` is a compile-time, mutable value used to compute constants and drive
loops. `for`/`while`/`if` with `var` conditions are unrolled at compile time —
they generate constraints, they do not execute during proving. Therefore loop
bounds and branch conditions that affect the *structure* of the circuit must be
known at compile time (from params/vars, not from input signals). To select
between values based on a *signal*, use a mux (`Mux1`, or `sel*a + (1-sel)*b`
with `sel` constrained to be a bit), not an `if`.

## Functions

`function`s compute and return `var` values at compile time (no signals, no
constraints). Use them for helper math that shapes the circuit (e.g. computing a
constant table), not for circuit logic.

```circom
function nbits(n) {
    var r = 0;
    while ((1 << r) <= n) { r++; }
    return r;
}
```

## Includes and circomlib

`include "circomlib/circuits/comparators.circom";` pulls in reusable templates.
[circomlib](https://github.com/iden3/circomlib) is the standard library:
`IsZero`, `IsEqual`, `LessThan`, `GreaterThan`, `Num2Bits`, `Bits2Num`,
`Poseidon`, `MiMC`, `Mux1..4`, `AND/OR/XOR`, `Sign`, `AliasCheck`, etc. Prefer
these — sound comparators and hashers are easy to get subtly wrong.

## Tags

Tags are metadata attached to signals with `{tag}` syntax, used to encode and
check invariants (e.g. a signal is known to fit in a given bit-width):

```circom
signal input {maxbits} a;     // tagged input
a.maxbits === 8;              // read/assert the tag value
```

Because `component main` cannot take tagged inputs, a wrapper template is used
to apply tags to untagged inputs. Circomkit's parser/codegen can generate these
wrappers.

## Anonymous components and tuples

Circom 2.1+ lets you instantiate and wire in one expression, and destructure
multiple outputs:

```circom
out <== IsEqual()([a, b]);            // anonymous component
(q, r) <== Divide()(a, b);            // tuple of outputs
signal output s <== Adder()(x, y);    // declare + assign inline
```

## Custom templates

`pragma custom_templates;` plus `template custom Name() { ... }` marks a template
as a PLONK/PLONKish custom gate. Only relevant for custom-gate protocols; ignore
for standard Groth16 work unless asked.

## assert and log

- `assert(cond);` — a witness-time check (and compile-time when the condition is
  constant). It aborts witness generation on failure; it is **not** a constraint,
  so it does not by itself make the circuit sound. Use it for input validity and
  parameter sanity.
- `log(...)` — prints during witness generation; debugging only.

## Gotchas

- **Unconstrained `<--`.** The single biggest footgun. Every hint must be tied
  down by constraints. If a value could be anything and still satisfy the
  circuit, a malicious prover will exploit it.
- **Assuming ranges.** Field elements wrap. If you rely on a value fitting in N
  bits, enforce it with `Num2Bits(N)` / `LessThan`.
- **Branching on signals.** `if (signal) {...}` doesn't work the way it looks —
  the structure is fixed at compile time. Use muxes.
- **Non-quadratic constraints.** Degree > 2 is rejected; introduce intermediates.
- **Public vs private.** Inputs are private unless in `public`; outputs always
  public. Don't leak a secret by making it an output.
