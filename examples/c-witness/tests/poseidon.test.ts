import {Circomkit, type WitnessTester} from 'circomkit';
import {beforeAll, describe, expect, it} from 'vitest';

const circomkit = new Circomkit({verbose: false, logLevel: 'silent'});

describe('poseidon chain', () => {
  const config = {file: 'poseidon', template: 'PoseidonChain', params: [2, 100]};
  let wasm: WitnessTester<['in'], ['out']>;
  let c: WitnessTester<['in'], ['out']>;

  beforeAll(async () => {
    wasm = await circomkit.WitnessTester('poseidon_2', config);
    // the same circuit, with the C witness calculator
    c = await circomkit.WitnessTester('poseidon_2', config, 'c');
  });

  it('should compute the same hash with C & WASM', async () => {
    const input = {in: [1, 2]};
    const {out} = await wasm.compute(input, ['out']);
    await c.expectPass(input, {out});
  });

  it('should compute the same witness with C & WASM', async () => {
    const input = {in: [3, 4]};
    expect(await c.calculateWitness(input)).toEqual(await wasm.calculateWitness(input));
  });
});
