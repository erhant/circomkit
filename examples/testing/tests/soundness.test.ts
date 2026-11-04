import {Circomkit, type WitnessTester} from 'circomkit';
import {beforeAll, describe, it} from 'vitest';

const circomkit = new Circomkit({verbose: false, logLevel: 'silent'});

// A witness tester only checks the witness that the circuit computes, which a prover does not have to use.
// To find under-constrained signals, edit a witness as a malicious prover would, and check the constraints.
describe('soundness', () => {
  let safe: WitnessTester<['in'], ['out']>;
  let unsafe: WitnessTester<['in'], ['out']>;

  beforeAll(async () => {
    safe = await circomkit.WitnessTester('is_zero', {file: 'iszero', template: 'IsZero'});
    unsafe = await circomkit.WitnessTester('is_zero_unsafe', {file: 'iszero', template: 'IsZeroUnsafe'});
  });

  it('should compute the same outputs', async () => {
    for (const circuit of [safe, unsafe]) {
      await circuit.expectPass({in: 0}, {out: 1});
      await circuit.expectPass({in: 5}, {out: 0});
    }
  });

  // with `inv = 0`, the output is 1, i.e. the prover claims that 5 is zero
  const FAKE = {'main.inv': 0n, 'main.out': 1n};

  it('should reject a fake witness', async () => {
    const witness = await safe.calculateWitness({in: 5});
    await safe.expectConstraintFail(await safe.editWitness(witness, FAKE));
  });

  it('should find that the unsafe one accepts a fake witness', async () => {
    const witness = await unsafe.calculateWitness({in: 5});
    await unsafe.expectConstraintPass(await unsafe.editWitness(witness, FAKE));
  });
});
