pragma circom 2.0.0;

// Multiplication of two numbers
template Multiplier2() {
  signal input in1;
  signal input in2;
  signal output out;

  out <== in1 * in2;
}

// Multiplication of N numbers
template Multiplier(N){
  signal input in[N];
  signal output out;
  component comp[N-1];

  // instantiate multiplier2 gates
  for (var i = 0; i < N-1; i++) {
    comp[i] = Multiplier2();
  }

  // multiply
  comp[0].in1 <== in[0];
  comp[0].in2 <== in[1];
  for(var i = 0; i < N-2; i++){
    comp[i+1].in1 <== comp[i].out;
    comp[i+1].in2 <== in[i+2];
  }
  out <== comp[N-2].out; 
}
