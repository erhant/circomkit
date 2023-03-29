module.exports = {
  // multiplication of 3 numbers
  multiplier3: {
    file: 'multiplier',
    template: 'Multiplier',
    publicInputs: [],
    templateInputs: [3],
  },
  // A 9x9 sudoku board
  sudoku9: {
    file: 'sudoku',
    template: 'Sudoku',
    publicInputs: ['puzzle'],
    templateInputs: [3],
  },
  // 64-bit floating point, 11-bit exponent and 52-bit mantissa
  fp64: {
    file: 'float_add',
    template: 'FloatAdd',
    publicInputs: [],
    templateInputs: [11, 52],
  },
  // 32-bit floating point, 8-bit exponent and 23-bit mantissa
  fp32: {
    file: 'float_add',
    template: 'FloatAdd',
    publicInputs: [],
    templateInputs: [8, 23],
  },
};
