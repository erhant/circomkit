import {createWasmTester} from '../utils/wasmTester';

describe('fibonacci_11', () => {
  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    circuit = await createWasmTester('fibonacci_11');
    await circuit.printConstraintCount();
  });

  it('should compute correctly', async () => {
    await circuit.expectCorrectAssert(
      {
        in: [1, 1],
      },
      {
        out: fibonacci([1, 1], 11),
      }
    );
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
