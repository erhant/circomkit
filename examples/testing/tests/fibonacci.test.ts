import {Circomkit, type WitnessTester} from 'circomkit';
import {beforeAll, describe, expect, it} from 'vitest';

const circomkit = new Circomkit({verbose: false, logLevel: 'silent'});

/** The `n`'th Fibonacci number, starting from `a` & `b`. */
function fibonacci(a: number, b: number, n: number): number {
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return n === 0 ? a : b;
}

describe('fibonacci', () => {
  const N = 11;
  let iterative: WitnessTester<['in'], ['out']>;
  let recursive: WitnessTester<['in'], ['out']>;

  beforeAll(async () => {
    iterative = await circomkit.WitnessTester(`fibonacci_${N}`, {
      file: 'fibonacci',
      template: 'Fibonacci',
      params: [N],
    });
    recursive = await circomkit.WitnessTester(`fibonacci_${N}_recursive`, {
      file: 'fibonacci',
      template: 'FibonacciRecursive',
      params: [N],
    });
  });

  it('should compute the Fibonacci number', async () => {
    await iterative.expectPass({in: [1, 1]}, {out: fibonacci(1, 1, N)});
    await recursive.expectPass({in: [1, 1]}, {out: fibonacci(1, 1, N)});
  });

  it('should have fewer constraints when iterative', async () => {
    const [i, r] = [await iterative.getConstraintCount(), await recursive.getConstraintCount()];
    console.log(`iterative: ${i} constraints, recursive: ${r} constraints`);
    expect(i).toBeLessThan(r);
  });

  it('should read intermediate signals', async () => {
    // the sequence has only linear constraints, which are optimized away unless the optimization level is 0
    const circuit = await circomkit.WitnessTester(`fibonacci_${N}_o0`, {
      file: 'fibonacci',
      template: 'Fibonacci',
      params: [N],
      overrides: {optimization: 0},
    });
    // `compute` returns any signal of the main component, here the whole sequence
    const {fib} = await circuit.compute({in: [1, 1]}, ['fib']);
    expect(fib).toEqual(Array.from({length: N + 1}, (_, i) => BigInt(fibonacci(1, 1, i))));
  });
});
