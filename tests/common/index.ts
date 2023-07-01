// create N random numbers for the multiplier circuit and find its product
export const N = 3;

const numbers = Array.from({length: N}, () => Math.floor(Math.random() * 100 * N));
const product = numbers.reduce((prev, acc) => acc * prev);

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
export const OUTPUT = {
  out: product,
};
