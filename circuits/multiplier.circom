pragma circom 2.0.0;

// Multiplication of two numbers
template MultiplicationGate() {
  signal input in[2];
  signal output out <== in[0] * in[1];
}

// Multiplication of N numbers
template Multiplier(N) {
  signal input in[N];
  signal output out;
  component comp[N-1];

  // instantiate gates
  for (var i = 0; i < N-1; i++) {
    comp[i] = MultiplicationGate();
  }

  // multiply
  comp[0].in <== [in[0], in[1]];
  for(var i = 0; i < N-2; i++) {
    comp[i+1].in <== [comp[i].out, in[i+2]];
  }
  out <== comp[N-2].out; 
}
