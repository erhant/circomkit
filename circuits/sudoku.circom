pragma circom 2.0.0;

// Assert that two elements are not equal.
// Done via the check if in0 - in1 is non-zero.
template NonEqual() {
  signal input in0;
  signal input in1;
  signal inv;

  inv <-- 1/ (in0 - in1);
  inv*(in0 - in1) === 1;
}

// Assert that all given values are unique
template Distinct(n) {
  signal input in[n];
  component nonEqual[n][n];
  for(var i = 0; i < n; i++){
    for(var j = 0; j < i; j++){
      nonEqual[i][j] = NonEqual();
      nonEqual[i][j].in0 <== in[i];
      nonEqual[i][j].in1 <== in[j];
    }
  }
}

// Enforce that 0 <= in < 16
template Bits4() {
  signal input in;
  signal bits[4];
  var bitsum = 0;
  for (var i = 0; i < 4; i++) {
    bits[i] <-- (in >> i) & 1;
    bits[i] * (bits[i] - 1) === 0;
    bitsum = bitsum + 2 ** i * bits[i];
  }
  bitsum === in;
}

// Check if a given signal is in range [1, 9]
template OneToNine() {
  signal input in;
  component lowerBound = Bits4();
  component upperBound = Bits4();
  lowerBound.in <== in - 1;
  upperBound.in <== in + 6;
}

template Sudoku(n) {
  // solution is a 2D array: indices are (row_i, col_i)
  signal input solution[n][n];
  // puzzle is the same, but a zero indicates a blank
  signal input puzzle[n][n];

  // make sure the solution agrees with the puzzle
	// meaning that non-empty cells of the puzzle should equal to the corresponding solution value
  // other values of the puzzle must be 0 (empty cell)
  for (var row_i = 0; row_i < n; row_i++) {
    for (var col_i = 0; col_i < n; col_i++) {
      puzzle[row_i][col_i] * (puzzle[row_i][col_i] - solution[row_i][col_i]) === 0;
    } 
  }

  // ensure all values in the solution are distinct and in range
  component inRange[n][n];
  component distinct[n];
  for (var row_i = 0; row_i < n; row_i++) {
    for (var col_i = 0; col_i < n; col_i++) {
      if (row_i == 0) {
        distinct[col_i] = Distinct(n);
      }
      inRange[row_i][col_i] = OneToNine();
      inRange[row_i][col_i].in <== solution[row_i][col_i];
      distinct[col_i].in[row_i] <== solution[row_i][col_i];
    }
  }
}

component main {public[puzzle]} = Sudoku(9);
