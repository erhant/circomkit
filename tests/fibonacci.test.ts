import {instantiate} from '../utils/instantiate';
import {createWasmTester} from '../utils/wasmTester';

describe('fibonacci', () => {
  const N = 19;
  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    const circuitName = 'fibonacci_' + N;
    instantiate(circuitName, 'test', {
      file: 'fibonacci',
      template: 'Fibonacci',
      publicInputs: [],
      templateParams: [N],
    });
    circuit = await createWasmTester(circuitName, 'test');
    await circuit.printConstraintCount();
  });

  it('should compute correctly', async () => {
    await circuit.expectCorrectAssert(
      {
        in: [1, 1],
      },
      {
        out: fibonacci([1, 1], N),
      }
    );
  });
});

// skipping because this takes a bit longer
describe.skip('fibonacci recursive', () => {
  const N = 19;
  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    const circuitName = 'fibonacci_recursive_' + N;
    instantiate(circuitName, 'test', {
      file: 'fibonacci',
      template: 'FibonacciRecursive',
      publicInputs: [],
      templateParams: [N],
    });
    circuit = await createWasmTester(circuitName, 'test');
    await circuit.printConstraintCount();
  });

  it('should compute correctly', async () => {
    await circuit.expectCorrectAssert(
      {
        in: [1, 1],
      },
      {
        out: fibonacci([1, 1], N),
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
  return n === 0 ? a : b;
}
