pragma circom 2.2.0;

// signals of many shapes: multi-dimensional arrays, component arrays and buses

bus Point() {
  signal x;
  signal y;
}

template Double() {
  signal input in;
  signal output out;
  signal sq;
  sq <== in * in;
  out <== sq + in;
}

template Signals() {
  signal input in[2][3];
  signal output out3[2][3][2];
  signal output sum;
  signal mid[2];
  input Point() p;
  output Point() q;
  output Point() qs[2];

  component d[2][3];
  var acc = 0;
  for (var i = 0; i < 2; i++) {
    for (var j = 0; j < 3; j++) {
      d[i][j] = Double();
      d[i][j].in <== in[i][j];
      out3[i][j][0] <== d[i][j].out;
      out3[i][j][1] <== d[i][j].out * in[i][j];
      acc += out3[i][j][1];
    }
    mid[i] <== in[i][0] * in[i][1];
  }
  sum <== acc + mid[0] * mid[1];
  q.x <== p.x * p.y;
  q.y <== p.x + p.y;
  for (var i = 0; i < 2; i++) {
    qs[i].x <== p.x * (i + 1);
    qs[i].y <== p.y * q.x;
  }
}
