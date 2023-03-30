import {createWasmTester} from '../utils/wasmTester';
import type {CircuitSignals} from '../types/circuit';

function fibonacci(init: [number, number], n: number): number {
  let [a, b] = init;
  for (let i = 2; i <= n; i++) {
    b = a + b;
    a = b - a;
  }
  return b;
}

const CIRCUIT_NAME = 'fibonacci_11';
describe(CIRCUIT_NAME, () => {
  const INPUT: CircuitSignals = {
    in: [1, 1],
  };

  describe('witness computation', () => {
    let circuit: Awaited<ReturnType<typeof createWasmTester>>;

    before(async () => {
      circuit = await createWasmTester(CIRCUIT_NAME);
    });

    it('should compute correctly', async () => {
      // compute witness
      const witness = await circuit.calculateWitness(INPUT, true);

      // witness should have valid constraints
      await circuit.checkConstraints(witness);

      // witness should have correct output
      const output = {
        out: fibonacci(INPUT.in, 11),
      };
      await circuit.assertOut(witness, output);
    });
  });
});
