pragma circom 2.0.0;

// classic under-constrained bugs, each next to its safe version

// 1 if `in` is zero, 0 otherwise
template IsZero() {
  signal input in;
  signal output out;
  signal inv;
  inv <-- in != 0 ? 1 / in : 0;
  out <== 1 - in * inv;
  in * out === 0;
}

// without `in * out === 0`, a prover can claim that any number is zero
template IsZeroUnsafe() {
  signal input in;
  signal output out;
  signal inv;
  inv <-- in != 0 ? 1 / in : 0;
  out <== 1 - in * inv;
}

// the `n` bits of `in`
template Num2Bits(n) {
  signal input in;
  signal output out[n];
  var sum = 0;
  for (var i = 0; i < n; i++) {
    out[i] <-- (in >> i) & 1;
    out[i] * (out[i] - 1) === 0;
    sum += out[i] * 2 ** i;
  }
  in === sum;
}

// without the bit checks, the "bits" can be any numbers that sum up to `in`
template Num2BitsUnsafe(n) {
  signal input in;
  signal output out[n];
  var sum = 0;
  for (var i = 0; i < n; i++) {
    out[i] <-- (in >> i) & 1;
    sum += out[i] * 2 ** i;
  }
  in === sum;
}

// `in` squared
template Square() {
  signal input in;
  signal output out;
  out <== in * in;
}

// `<--` only assigns, so `out` is not constrained at all
template SquareUnsafe() {
  signal input in;
  signal output out;
  out <-- in * in;
}

// a bug within a component: is `in` non-zero?
template IsNonZero() {
  signal input in;
  signal output out;
  component isZero = IsZeroUnsafe();
  isZero.in <== in;
  out <== 1 - isZero.out;
}
