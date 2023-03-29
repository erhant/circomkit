pragma circom 2.0.0;

// Fibonacci with custom starting numbers
template Fibonacci(n) {
  assert(n >= 2);
  signal input in[2];
  signal output out;

  // compute the sequence
  signal f[n+1];
  fib[0] <== in[0];
  fib[1] <== in[1];
  for (var i = 2; i <= n; i++) {
    fib[i] <== fib[i-2] + fib[i-1];
  }

  out <== fib[n];
}
