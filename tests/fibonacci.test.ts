import {createWasmTester} from '../utils/wasmTester';
import type {CircuitSignals} from '../types/circuit';

describe('fibonacci_11', () => {
  const INPUT: CircuitSignals = {
    in: [1, 1],
  };

  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    circuit = await createWasmTester('fibonacci_11');
  });

  it('should compute correctly', async () => {
    const witness = await circuit.calculateWitness(INPUT, true);
    await circuit.checkConstraints(witness);
    const output = {
      out: fibonacci(INPUT.in, 11),
    };
    await circuit.assertOut(witness, output);
  });
});

// simple fibonacci with 2 variables
function fibonacci(init: [number, number], n: number): number {
  if (n < 0) {
    throw new Error('N must be positive');
  }

  let [a, b] = init;
  for (let i = 2; i <= n; i++) {
    b = a + b;
    a = b - a;
  }
  return n == 0 ? a : b;
}
