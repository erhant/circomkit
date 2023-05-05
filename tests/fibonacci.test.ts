import {instantiate} from '../utils/instantiate';
import {WasmTester, createWasmTester} from '../utils/wasmTester';

const CIRCUIT_FILE = 'fibonacci';
describe(CIRCUIT_FILE, () => {
  const N = 19;
  let circuit: WasmTester<['in'], ['out']>;

  before(async () => {
    const circuitName = `${CIRCUIT_FILE}_${N}`;
    instantiate(circuitName, {
      file: CIRCUIT_FILE,
      template: 'Fibonacci',
      publicInputs: [],
      templateParams: [N],
    });
    circuit = await createWasmTester(circuitName);
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
    const circuitName = `${CIRCUIT_FILE}_${N}_recursive`;
    instantiate(circuitName, {
      file: CIRCUIT_FILE,
      template: 'FibonacciRecursive',
      publicInputs: [],
      templateParams: [N],
    });
    circuit = await createWasmTester(circuitName);
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
