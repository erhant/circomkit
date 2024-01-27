import {Circomkit, ProofTester} from '../src';
import {PTAU_PATH, prepareMultiplier} from './common';

describe('proof tester', () => {
  let circuit: ProofTester<['in']>;
  const {
    circuit: {name, config},
    signals: {input},
  } = prepareMultiplier(3);

  before(async () => {
    const circomkit = new Circomkit({
      verbose: false,
      logLevel: 'silent',
      protocol: 'plonk',
    });
    circomkit.instantiate(name, config);
    await circomkit.setup(name, PTAU_PATH);
    circuit = await circomkit.ProofTester(name);
  });

  it('should verify a proof correctly', async () => {
    const {proof, publicSignals} = await circuit.prove(input);
    await circuit.expectPass(proof, publicSignals);
  });

  it('should NOT verify a proof with invalid public signals', async () => {
    const {proof} = await circuit.prove(input);
    await circuit.expectFail(proof, ['1']);
  });
});
