pragma circom 2.0.0;

// Outputs 1 if `in` is zero, and 0 otherwise
template IsZero() {
  signal input in;
  signal output out;

  signal inv;
  inv <-- in != 0 ? 1 / in : 0;
  out <== 1 - in * inv;
  in * out === 0;
}

// IsZero without its last constraint: a prover can claim that any number is zero
template IsZeroUnsafe() {
  signal input in;
  signal output out;

  signal inv;
  inv <-- in != 0 ? 1 / in : 0;
  out <== 1 - in * inv;
}
