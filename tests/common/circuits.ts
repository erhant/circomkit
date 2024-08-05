import {randomBytes} from 'crypto';
import type {CircuitConfig, CircuitSignals} from '../../src';
import {primes} from '../../src/utils';

type PreparedTestCircuit<S extends Record<string, CircuitSignals>> = {
  /** Signals, you are most likely to prepare an `input` and `output` here. */
  signals: S;
  /** Name for the input path to an existing input JSON file under `inputs` folder. */
  inputName: string;
  /** Circuit information. */
  circuit: {
    /** Circuit name. */
    name: string;
    /** Circuit configuration. */
    config: CircuitConfig;
    /** Circuit size, i.e. constraint count. */
    size?: number; // TODO: we should support bigint for this
    /**
     * If `exact`, the circuit size MUST exactly match the computed size.
     * Otherwise, the circuit can be a bit larger (i.e. over-constrained).
     */
    exact?: boolean;
  };
};

/**
 * Prepares inputs & expected outputs for the
 * [Multiplier](../../circuits/multiplier.circom) circuit.
 *
 * @param N number of integers to multiply.
 * @param order order of the finite field, defaults to order for `bn128` prime option.
 * This is important when you have many numbers, as the product will respect the modular arithmetic.
 */
export function prepareMultiplier(N: number, order: bigint = primes['bn128']) {
  const name = `multiplier_${N}`;
  const config = {
    file: 'multiplier',
    template: 'Multiplier',
    params: [N],
  };

  // N-1 quadratic constraints for multiplications
  // N quadratic constraints for inverting the numbers
  // N linear constraints to check each number is non-zero
  // TOTAL: 3*N - 1
  const size = 3 * N - 1;

  const numbers: bigint[] = Array.from({length: N}, () => BigInt(2) + BigInt('0x' + randomBytes(8).toString('hex')));
  const product: bigint = numbers.reduce((prev, acc) => acc * prev) % order;
  const malicious: bigint[] = Array.from({length: N}, () => BigInt(1));
  malicious[0] = product;

  const signals = {
    /** Just an array of random numbers. */
    input: {in: numbers},
    /** Product of the numbers in `input`, in modular arithmetic w.r.t prime. */
    output: {out: product},
    /** A malicious input, all 1s but one element that is the product.
     * Instead of `n = a * b * c` it proves `n = n * 1 * 1`. */
    badInput: {in: malicious},
  };

  return {
    signals,
    circuit: {name, config, size, exact: true},
    inputName: 'input.test',
  } as PreparedTestCircuit<typeof signals>;
}
