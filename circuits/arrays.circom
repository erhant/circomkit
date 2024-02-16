pragma circom 2.0.0;

template Arrays(N, M) {
  signal input in; 
  signal input in1D[N]; 
  signal input in2D[N][M]; 

  in === 1;
  for (var i = 1; i < N; i++) {
    in1D[i-1] + 1 === in1D[i];
  }

  for (var i = 0; i < N; i++) {
    for (var j = 1; j < M; j++) {
      in2D[i][j-1] + 1 === in2D[i][j];
    }
  }

  log(1, N, N + M);
}
