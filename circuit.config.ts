import {Config} from './types/config';

/**
 * A configuration object for circuit `main` components.
 */
const config: Config = {
  // multiplication of 3 numbers
  multiplier_3: {
    file: 'multiplier',
    template: 'Multiplier',
    params: [3],
  },
  // A 9x9 sudoku board
  sudoku_9x9: {
    file: 'sudoku',
    template: 'Sudoku',
    pubs: ['puzzle'],
    params: [Math.sqrt(9)],
  },
  // A 4x4 sudoku board
  sudoku_4x4: {
    file: 'sudoku',
    template: 'Sudoku',
    pubs: ['puzzle'],
    params: [Math.sqrt(4)],
  },
  // 64-bit floating point, 11-bit exponent and 52-bit mantissa
  fp64: {
    file: 'float_add',
    template: 'FloatAdd',
    params: [11, 52],
  },
  // 32-bit floating point, 8-bit exponent and 23-bit mantissa
  fp32: {
    file: 'float_add',
    template: 'FloatAdd',
    params: [8, 23],
  },
  // 11-th Fibonacci number
  fibonacci_11: {
    file: 'fibonacci',
    template: 'Fibonacci',
    params: [11],
  },
};

export default config as Readonly<typeof config>;
