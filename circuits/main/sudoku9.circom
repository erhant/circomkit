pragma circom 2.0.0;

include "../../circuits/sudoku.circom";

// Circuit for 3^2 * 3^2 sudoku
component main {public[puzzle]} = Sudoku(3);
