import {instantiate} from '../utils/instantiate';
import {createWasmTester} from '../utils/wasmTester';

type BoardSizes = 4 | 9;

const INPUTS: {[N in BoardSizes]: any} = {
  9: {
    solution: [
      [1, 9, 4, 8, 6, 5, 2, 3, 7],
      [7, 3, 5, 4, 1, 2, 9, 6, 8],
      [8, 6, 2, 3, 9, 7, 1, 4, 5],
      [9, 2, 1, 7, 4, 8, 3, 5, 6],
      [6, 7, 8, 5, 3, 1, 4, 2, 9],
      [4, 5, 3, 9, 2, 6, 8, 7, 1],
      [3, 8, 9, 6, 5, 4, 7, 1, 2],
      [2, 4, 6, 1, 7, 9, 5, 8, 3],
      [5, 1, 7, 2, 8, 3, 6, 9, 4],
    ],
    puzzle: [
      [0, 0, 0, 8, 6, 0, 2, 3, 0],
      [7, 0, 5, 0, 0, 0, 9, 0, 8],
      [0, 6, 0, 3, 0, 7, 0, 4, 0],
      [0, 2, 0, 7, 0, 8, 0, 5, 0],
      [0, 7, 8, 5, 0, 0, 0, 0, 0],
      [4, 0, 0, 9, 0, 6, 0, 7, 0],
      [3, 0, 9, 0, 5, 0, 7, 0, 2],
      [0, 4, 0, 1, 0, 9, 0, 8, 0],
      [5, 0, 7, 0, 8, 0, 0, 9, 4],
    ],
  },
  4: {
    solution: [
      [4, 1, 3, 2],
      [3, 2, 4, 1],
      [2, 4, 1, 3],
      [1, 3, 2, 4],
    ],
    puzzle: [
      [0, 1, 0, 2],
      [3, 2, 0, 0],
      [0, 0, 1, 0],
      [1, 0, 0, 0],
    ],
  },
};

[9, 4].map(N =>
  describe(`sudoku (${N} by ${N})`, () => {
    const INPUT = INPUTS[N as BoardSizes];
    let circuit: Awaited<ReturnType<typeof createWasmTester>>;

    before(async () => {
      const circuitName = `sudoku_${N}x${N}`;
      instantiate(circuitName, 'test', {
        file: 'sudoku',
        template: 'Sudoku',
        publicInputs: ['puzzle'],
        templateParams: [Math.sqrt(N)],
      });
      circuit = await createWasmTester(circuitName);
    });

    it('should compute correctly', async () => {
      await circuit.expectCorrectAssert(INPUT);
    });

    it('should NOT accept non-distinct rows', async () => {
      const badInput = JSON.parse(JSON.stringify(INPUT));
      badInput.solution[0][0] = badInput.solution[0][1];
      await circuit.expectFailedAssert(badInput);
    });

    it('should NOT accept non-distinct columns', async () => {
      const badInput = JSON.parse(JSON.stringify(INPUT));
      badInput.solution[0][0] = badInput.solution[1][0];
      await circuit.expectFailedAssert(badInput);
    });

    it('should NOT accept non-distinct square', async () => {
      const badInput = JSON.parse(JSON.stringify(INPUT));
      badInput.solution[0][0] = badInput.solution[1][1];
      await circuit.expectFailedAssert(badInput);
    });

    it('should NOT accept empty value in solution', async () => {
      const badInput = JSON.parse(JSON.stringify(INPUT));
      badInput.solution[0][0] = 0;
      await circuit.expectFailedAssert(badInput);
    });

    it('should NOT accept out-of-range values', async () => {
      const badInput = JSON.parse(JSON.stringify(INPUT));
      badInput.solution[0][0] = 99999;
      await circuit.expectFailedAssert(badInput);
    });
  })
);

describe('sudoku utilities', () => {
  describe('assert bit length', () => {
    const b = 3; // bit count

    let circuit: Awaited<ReturnType<typeof createWasmTester>>;

    before(async () => {
      const circuitName = 'abl_' + b;
      instantiate(circuitName, 'test/sudoku', {
        file: 'sudoku',
        template: 'AssertBitLength',
        publicInputs: [],
        templateParams: [b],
      });
      circuit = await createWasmTester(circuitName, 'test/sudoku');
    });

    it('should pass for input < 2 ** b', async () => {
      await circuit.expectCorrectAssert({
        in: 2 ** b - 1,
      });
    });

    it('should fail for input >= 2 ** b ', async () => {
      await circuit.expectFailedAssert({
        in: 2 ** b,
      });
      await circuit.expectFailedAssert({
        in: 2 ** b + 1,
      });
    });
  });

  describe('distinct', () => {
    const n = 3;

    let circuit: Awaited<ReturnType<typeof createWasmTester>>;

    before(async () => {
      const circuitName = 'distinct_' + n;
      instantiate(circuitName, 'test/sudoku', {
        file: 'sudoku',
        template: 'Distinct',
        publicInputs: [],
        templateParams: [n],
      });
      circuit = await createWasmTester(circuitName, 'test/sudoku');
    });

    it('should pass if all inputs are unique', async () => {
      await circuit.expectCorrectAssert({
        in: Array(n)
          .fill(0)
          .map((v, i) => v + i),
      });
    });

    it('should fail if there is a duplicate', async () => {
      const arr = Array(n)
        .fill(0)
        .map((v, i) => v + i);
      // make a duplicate
      arr[0] = arr[arr.length - 1];
      await circuit.expectFailedAssert({
        in: arr,
      });
    });
  });

  describe('in range', () => {
    const MIN = 1;
    const MAX = 9;
    let circuit: Awaited<ReturnType<typeof createWasmTester>>;

    before(async () => {
      const circuitName = 'inRange_' + MIN + '_' + MAX;
      instantiate(circuitName, 'test/sudoku', {
        file: 'sudoku',
        template: 'InRange',
        publicInputs: [],
        templateParams: [MIN, MAX],
      });
      circuit = await createWasmTester(circuitName, 'test/sudoku');
    });

    it('should pass for in range', async () => {
      await circuit.expectCorrectAssert({
        in: MAX,
      });
      await circuit.expectCorrectAssert({
        in: MIN,
      });
      await circuit.expectCorrectAssert({
        in: Math.floor((MIN + MAX) / 2),
      });
    });

    it('should FAIL for out of range (upper bound)', async () => {
      await circuit.expectFailedAssert({
        in: MAX + 1,
      });
    });

    it('should FAIL for out of range (lower bound)', async () => {
      if (MIN > 0) {
        await circuit.expectFailedAssert({
          in: MIN - 1,
        });
      }
    });
  });
});
