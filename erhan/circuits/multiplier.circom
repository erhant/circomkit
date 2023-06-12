pragma circom 2.0.0;

template Multiplier(N) {
  assert(N > 1);
  signal input in[N];
  signal output out;

  signal inner[N-1];

  inner[0] <== in[0] * in[1];
  for(var i = 2; i < N; i++) {
    inner[i-1] <== inner[i-2] * in[i];
  }

  out <== inner[N-2]; 
}