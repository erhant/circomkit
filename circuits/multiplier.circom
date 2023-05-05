pragma circom 2.0.0;

template MultiplicationGate() {
  signal input in[2];
  signal output out <== in[0] * in[1];
}

template Multiplier(N) {
  assert(N > 1);
  signal input in[N];
  signal output out;
  component gate[N-1];

  // instantiate gates
  for (var i = 0; i < N-1; i++) {
    gate[i] = MultiplicationGate();
  }

  // multiply
  gate[0].in <== [in[0], in[1]];
  for (var i = 0; i < N-2; i++) {
    gate[i+1].in <== [gate[i].out, in[i+2]];
  }
  out <== gate[N-2].out; 
}

// Alternative way using anonymous components
template MultiplierAnonymous(N) {
  assert(N > 1);
  signal input in[N];
  signal output out;

  signal inner[N-1];
  inner[0] <== MultiplicationGate()([in[0], in[1]]);
  for(var i = 0; i < N-2; i++) {
    inner[i+1] <== MultiplicationGate()([inner[i], in[i+2]]);
  }
  out <== inner[N-2]; 
}

// Alternative way without the gate component
template MultiplierSimple(N) {
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
