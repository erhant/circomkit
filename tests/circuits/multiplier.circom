pragma circom 2.0.0;

template IsZero() {
  signal input in;
  signal output out;

  signal inv;
  inv <-- in != 0 ? (1 / in) : 0;

  out <== (-in * inv) + 1;
  in * out === 0;
}

template Multiplier(n) {
  assert(n > 1);
  signal input in[n];
  signal output out;

  // assert that all numbers are != 1
  component isZero[n];
  for (var i = 0; i < n; i++) {
    isZero[i] = IsZero();
    isZero[i].in <== in[i] - 1;
    isZero[i].out === 0;
  }  

  // multiply
  signal inner[n-1];
  inner[0] <== in[0] * in[1];
  for (var i = 2; i < n; i++) {
    inner[i-1] <== inner[i-2] * in[i];
  }

  out <== inner[n-2]; 
}
