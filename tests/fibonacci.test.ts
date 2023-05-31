import WasmTester from '../src/wasmTester';

describe('fibonacci', () => {
  let circuit: WasmTester<['in'], ['out']>;

  const N = 19;

  before(async () => {
    circuit = await WasmTester.new(`fibonacci_${N}`, {
      file: 'fibonacci',
      template: 'Fibonacci',
      params: [N],
    });
    await circuit.checkConstraintCount();
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
  let circuit: WasmTester<['in'], ['out']>;

  const N = 19;

  before(async () => {
    circuit = await WasmTester.new(`fibonacci_${N}_recursive`, {
      file: 'fibonacci',
      template: 'FibonacciRecursive',
      params: [N],
    });
    await circuit.checkConstraintCount();
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
