pragma circom 2.0.0;

// Run-time errors:
// - An input signal has more elements than expected
// - An input signal has less elements than expected
// - A signal is missing
// - A signal is extra
// - A run-time assertion error occurs.
// - Division-by-zero

template Errors() {
  signal input in; 
  signal input inin[2]; 
  signal output out;
 
  assert(in != 1);
  out <== in + (inin[0] * inin[1]);
}

// Run-time error in the witness calculator itself: modulo by zero traps in WASM
template ModuloByZero() {
  signal input in;
  signal output out;

  out <-- 7 % in;
}

// Run-time error in the witness calculator itself: deep recursion overflows its stack
function depth(n) {
  if (n == 0) return 0;
  return depth(n - 1) + 1;
}

template Recursion() {
  signal input in;
  signal output out;

  out <-- depth(in);
}
