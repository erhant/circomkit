pragma circom 2.0.0;

template MyTest() {
  signal input in;
  signal output out;

  out <== in * 2;
}

component main = MyTest();
