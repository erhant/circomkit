import {Circomkit, type CircuitSignals, type WitnessTester} from 'circomkit';
import {beforeAll, describe, it} from 'vitest';

const circomkit = new Circomkit({verbose: false, logLevel: 'silent'});

const INPUTS: Record<4 | 9, CircuitSignals<['solution', 'puzzle']>> = {
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
};

// the same template, instantiated for two board sizes
for (const N of [4, 9] as const) {
  describe(`sudoku ${N}x${N}`, () => {
    const INPUT = INPUTS[N];
    let circuit: WitnessTester<['solution', 'puzzle']>;

    /** The solution, with one cell changed. */
    function withCell(row: number, col: number, value: number) {
      const solution = structuredClone(INPUT.solution) as number[][];
      solution[row][col] = value;
      return {...INPUT, solution};
    }

    beforeAll(async () => {
      circuit = await circomkit.WitnessTester(`sudoku_${N}x${N}`, {
        file: 'sudoku',
        template: 'Sudoku',
        pubs: ['puzzle'],
        params: [Math.sqrt(N)],
      });
    });

    it('should accept the solution', async () => {
      await circuit.expectPass(INPUT);
    });

    it('should reject a repeated value in a row', async () => {
      await circuit.expectFail(withCell(0, 0, INPUT.solution[0][1] as number));
    });

    it('should reject a repeated value in a column', async () => {
      await circuit.expectFail(withCell(0, 0, INPUT.solution[1][0] as number));
    });

    it('should reject a repeated value in a square', async () => {
      await circuit.expectFail(withCell(0, 0, INPUT.solution[1][1] as number));
    });

    it('should reject values out of range', async () => {
      await circuit.expectFail(withCell(0, 0, 0));
      await circuit.expectFail(withCell(0, 0, N + 1));
    });
  });
}

describe('in range', () => {
  const [MIN, MAX] = [1, 9];
  let circuit: WitnessTester<['in']>;

  beforeAll(async () => {
    circuit = await circomkit.WitnessTester(`in_range_${MIN}_${MAX}`, {
      file: 'sudoku',
      template: 'InRange',
      params: [MIN, MAX],
    });
  });

  it('should accept the bounds', async () => {
    await circuit.expectPass({in: MIN});
    await circuit.expectPass({in: MAX});
  });

  it('should reject values out of the bounds', async () => {
    await circuit.expectFail({in: MIN - 1});
    await circuit.expectFail({in: MAX + 1});
  });
});
