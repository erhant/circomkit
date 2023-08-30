pragma circom 2.0.0;

// Fibonacci with custom starting numbers, recursive & inefficient
template Fibonacci(n) {
  signal input in[2];
  signal output out;
  component f1, f2;
  if (n <= 1) {
    out <== in[n];
  } else {
    f1 = Fibonacci(n-1);
    f1.in <== in;
    f2 = Fibonacci(n-2);
    f2.in <== in;
    out <== f1.out + f2.out;
  }
}
