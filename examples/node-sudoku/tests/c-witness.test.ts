import {readFileSync} from 'node:fs';
import {Circomkit, type WitnessTester} from 'circomkit';
import {beforeAll, describe, expect, it} from 'vitest';

// needs the dependencies of the C witness calculator, see the README
const circomkit = new Circomkit({verbose: false, logLevel: 'silent'});

describe('sudoku 9x9 with the C witness calculator', () => {
  const config = {file: 'sudoku', template: 'Sudoku', pubs: ['puzzle'], params: [3]};
  const input = JSON.parse(readFileSync('./inputs/sudoku_9x9.json', 'utf-8'));
  let wasm: WitnessTester<['solution', 'puzzle']>;
  let c: WitnessTester<['solution', 'puzzle']>;

  beforeAll(async () => {
    wasm = await circomkit.WitnessTester('sudoku_9x9', config);
    // the same circuit, with the C witness calculator, which can be faster for large circuits
    c = await circomkit.WitnessTester('sudoku_9x9', config, 'c');
  });

  it('should compute the same witness as WASM', async () => {
    expect(await c.calculateWitness(input)).toEqual(await wasm.calculateWitness(input));
  });

  it('should reject a wrong solution', async () => {
    const solution = structuredClone(input.solution);
    solution[0][0] = solution[0][1];
    await c.expectFail({...input, solution});
  });
});
