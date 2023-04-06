import {Config} from './types/circuit';

/**
 * A configuration object for circuit `main` components.
 */
const config: Config = {
  // multiplication of 3 numbers
  mert: {
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
};

export default config as Readonly<typeof config>;