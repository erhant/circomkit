// create N random numbers for the multiplier circuit and find its product
export const N = 3;

const numbers = Array.from({length: N}, () => Math.floor(Math.random() * 100 * N));
const product = numbers.reduce((prev, acc) => acc * prev);
const malicious = Array.from({length: N}, () => 1);
malicious[0] = product;

export const CIRCUIT_NAME = `multiplier_${N}`;
export const CIRCUIT_CONFIG = {
  file: 'multiplier',
  template: 'Multiplier',
  params: [N],
};
export const INPUT_NAME = 'test-input';
export const PTAU_PATH = './ptau/powersOfTau28_hez_final_08.ptau';

export const INPUT = {
  in: numbers,
};
export const BAD_INPUT = {
  in: malicious,
};
export const OUTPUT = {
  out: product,
};

export const FIBONACCI_CASES = [
  {
    file: 'fibonacci/vanilla',
    circuit: 'fibo_vanilla',
    input: 'vanilla',
  },
  {
    file: 'fibonacci/recursive',
    circuit: 'fibo_recursive',
    input: 'recursive',
  },
];
