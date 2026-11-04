pragma circom 2.0.0;

template MultiplicationGate() {
  signal input in[2];
  signal output out <== in[0] * in[1];
}

// Multiplies N numbers
template Multiplier(N) {
  assert(N > 1);
  signal input in[N];
  signal output out;

  signal inner[N-1];
  inner[0] <== MultiplicationGate()([in[0], in[1]]);
  for (var i = 0; i < N-2; i++) {
    inner[i+1] <== MultiplicationGate()([inner[i], in[i+2]]);
  }
  out <== inner[N-2];
}
