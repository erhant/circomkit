pragma circom 2.0.0;

include "circomlib/circuits/bitify.circom";

// Finds Math.floor(log2(n))
function log2(n) {
  var tmp = 1, ans = 1;
  while (tmp < n) {
    ans++;
    tmp *= 2;
  }
  return ans;
}

// Assert that two elements are not equal
template NonEqual() {
  signal input in[2];
  signal inv;

  // we check if (in[0] - in[1] != 0)
  // because 1/0 results in 0, so the constraint won't hold
  inv <-- 1 / (in[1] - in[0]);
  inv * (in[1] - in[0]) === 1;
}

// Assert that number is representable by b-bits
template AssertBitLength(b) {
  assert(b < 254);
  signal input in;

  // compute b-bit representation of the number  
  signal bits[b];
  var sum_of_bits = 0;
  for (var i = 0; i < b; i++) {
    bits[i] <-- (in >> i) & 1;
    bits[i] * (1 - bits[i]) === 0;
    sum_of_bits += (2 ** i) * bits[i];
  }

  // check if sum is equal to number itself
  in === sum_of_bits;
}

// Checks that `in` is in range [MIN, MAX]
template InRange(MIN, MAX) {
  assert(MIN < MAX);
  signal input in;
  
  // number of bits to represent MAX
  var b = log2(MAX) + 1; 

  component lowerBound = AssertBitLength(b);
  component upperBound = AssertBitLength(b);
  lowerBound.in <== in - MIN; // e.g. 1 - 1 = 0 (for 0 <= in)
  upperBound.in <== in + (2 ** b) - MAX - 1; // e.g. 9 + (15 - 9) = 15 (for in <= 15)
}

// Assert that all given values are unique
template Distinct(n) {
  signal input in[n];
  component nonEqual[n][n]; // TODO; has extra comps here
  for(var i = 0; i < n; i++){
    for(var j = 0; j < i; j++){
      nonEqual[i][j] = NonEqual();
      nonEqual[i][j].in <== [in[i], in[j]];
    }
  }
}

template Sudoku(n_sqrt) {
  var n = n_sqrt * n_sqrt;
  signal input solution[n][n]; // solution is a 2D array of numbers
  signal input puzzle[n][n]; // puzzle is the same, but a zero indicates a blank

  // ensure that solution & puzzle agrees
  for (var row_i = 0; row_i < n; row_i++) {
    for (var col_i = 0; col_i < n; col_i++) {
      // puzzle is either empty (0), or the same as solution
      puzzle[row_i][col_i] * (puzzle[row_i][col_i] - solution[row_i][col_i]) === 0;
    } 
  }

  // ensure all values in the solution are in range
  component inRange[n][n];
  for (var row_i = 0; row_i < n; row_i++) {
    for (var col_i = 0; col_i < n; col_i++) {
      inRange[row_i][col_i] = InRange(1, n);
      inRange[row_i][col_i].in <== solution[row_i][col_i];
    }
  }

  // ensure all values in the solution are distinct
  component distinctRows[n];
  for (var row_i = 0; row_i < n; row_i++) {
    for (var col_i = 0; col_i < n; col_i++) {
      if (row_i == 0) {
        distinctRows[col_i] = Distinct(n);
      }
      distinctRows[col_i].in[row_i] <== solution[row_i][col_i];
    }
  }
  component distinctCols[n];
  for (var col_i = 0; col_i < n; col_i++) {
    for (var row_i = 0; row_i < n; row_i++) {
      if (col_i == 0) {
        distinctCols[row_i] = Distinct(n);
      }
      distinctCols[row_i].in[col_i] <== solution[row_i][col_i];
    }
  }

  // ensure that all values in squares are distinct
  component distinctSquares[n];
  var s_i = 0;
  for (var sr_i = 0; sr_i < n_sqrt; sr_i++) {
    for (var sc_i = 0; sc_i < n_sqrt; sc_i++) {
      // square index
      distinctSquares[s_i] = Distinct(n);
      
      // (r, c) now marks the start of this square
      var r = sr_i * n_sqrt;
      var c = sc_i * n_sqrt;
      var i = 0;
      for (var row_i = r; row_i < r + n_sqrt; row_i++) {
        for (var col_i = c; col_i < c + n_sqrt; col_i++) {
          distinctSquares[s_i].in[i] <== solution[row_i][col_i];
          i++;
        }
      }

      s_i++;
    }
  }

}

