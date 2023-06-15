pragma circom 2.0.0;

template Multiplier(n) {
  assert(n > 1);
  signal input in[n];
  signal output out;

  signal inner[n-1];

  inner[0] <== in[0] * in[1];
  for(var i = 2; i < n; i++) {
    inner[i-1] <== inner[i-2] * in[i];
  }

  out <== inner[n-2]; 
}
