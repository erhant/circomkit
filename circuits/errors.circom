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
