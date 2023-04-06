pragma circom 2.0.0;

// Fibonacci with custom starting numbers
template Fibonacci(n) {
  assert(n >= 2);
  signal input in[2];
  signal output out;

  signal fib[n+1];
  fib[0] <== in[0];
  fib[1] <== in[1];
  for (var i = 2; i <= n; i++) {
    fib[i] <== fib[i-2] + fib[i-1];
  }

  out <== fib[n];
}

// Fibonacci with custom starting numbers, recursive & inefficient
template FibonacciRecursive(n) {
  signal input in[2];
  signal output out;
  component f1, f2;
  if (n <= 1) {
    out <== in[n];
  } else {
    f1 = FibonacciRecursive(n-1);
    f1.in <== in;
    f2 = FibonacciRecursive(n-2);
    f2.in <== in;
    out <== f1.out + f2.out;
  }
}
