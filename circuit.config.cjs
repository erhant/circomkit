/**
 * @type {import("./types/circuit").Config}
 */
const config = {
  // multiplication of 3 numbers
  multiplier_3: {
    file: 'multiplier',
    template: 'Multiplier',
    publicInputs: [],
    templateParams: [3],
  },
  // A 9x9 sudoku board
  sudoku_9x9: {
    file: 'sudoku',
    template: 'Sudoku',
    publicInputs: ['puzzle'],
    templateParams: [Math.sqrt(9)],
  },
  // A 4x4 sudoku board
  sudoku_4x4: {
    file: 'sudoku',
    template: 'Sudoku',
    publicInputs: ['puzzle'],
    templateParams: [Math.sqrt(4)],
  },
  // 64-bit floating point, 11-bit exponent and 52-bit mantissa
  fp64: {
    file: 'float_add',
    template: 'FloatAdd',
    publicInputs: [],
    templateParams: [11, 52],
  },
  // 32-bit floating point, 8-bit exponent and 23-bit mantissa
  fp32: {
    file: 'float_add',
    template: 'FloatAdd',
    publicInputs: [],
    templateParams: [8, 23],
  },
  // 11-th Fibonacci number
  fibonacci_11: {
    file: 'fibonacci',
    template: 'Fibonacci',
    publicInputs: [],
    templateParams: [11],
  },
  // checks that a number fits to given bit count
  cbl_3: {
    file: 'float_add',
    template: 'CheckBitLength',
    publicInputs: [],
    templateParams: [3],
  },
};

module.exports = config;
