import WasmTester from '../utils/wasmTester';

const CIRCUIT_FILE = 'fibonacci';
describe(CIRCUIT_FILE, () => {
  const N = 19;
  let circuit: WasmTester<['in'], ['out']>;

  before(async () => {
    circuit = await WasmTester.new(`${CIRCUIT_FILE}_${N}`, {
      file: CIRCUIT_FILE,
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
describe.skip(CIRCUIT_FILE + ' recursive', () => {
  const N = 19;
  let circuit: WasmTester<['in'], ['out']>;

  before(async () => {
    circuit = await WasmTester.new(`${CIRCUIT_FILE}_${N}_recursive`, {
      file: CIRCUIT_FILE,
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
