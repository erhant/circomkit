pragma circom 2.0.0;

template Multiout(N) {
  signal input a[N]; 
  signal input b[N]; 
  var newSize = N + N - 1;
  signal output cOut[N];
  signal output aOut[newSize];
  signal output bOut[newSize];
 
  var a1[newSize];
  var b1[newSize];
  var c1[N];
  for(var i = 0; i<N; i++) {
    a1[i] = a[i] * i;
    b1[i] = b[i] * i;
    c1[i] = a[i] * b[i];
  }

  cOut <== c1;
  aOut <== a1;
  bOut <== b1;
}

