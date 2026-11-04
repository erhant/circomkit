import {Circomkit, type WitnessTester} from 'circomkit';
import {beforeAll, describe, expect, it} from 'vitest';

const circomkit = new Circomkit({verbose: false, logLevel: 'silent'});

describe('multiplier', () => {
  const N = 3;
  // the signal names make inputs & outputs type-safe
  let circuit: WitnessTester<['in'], ['out']>;

  beforeAll(async () => {
    circuit = await circomkit.WitnessTester(`multiplier_${N}`, {
      file: 'multiplier',
      template: 'Multiplier',
      params: [N],
    });
  });

  it('should multiply', async () => {
    await circuit.expectPass({in: [2, 4, 10]}, {out: 80});
  });

  it('should fail for a missing input', async () => {
    await circuit.expectFail({in: [2, 4]});
  });

  it('should have a constraint per multiplication', async () => {
    await circuit.expectConstraintCount(N - 1, true);
  });

  it('should have readable constraints', async () => {
    // handy to spot under-constrained signals, print them with `console.log(constraints.join('\n'))`
    expect(await circuit.constraints()).toEqual(['in[0] * in[1] = inner[0]', 'inner[0] * in[2] = out']);
  });
});

// any template can be tested on its own, with a main component of its own
describe('multiplication gate', () => {
  let circuit: WitnessTester<['in'], ['out']>;

  beforeAll(async () => {
    circuit = await circomkit.WitnessTester('multiplication_gate', {
      file: 'multiplier',
      template: 'MultiplicationGate',
    });
  });

  it('should multiply', async () => {
    await circuit.expectPass({in: [7, 5]}, {out: 35});
  });
});
