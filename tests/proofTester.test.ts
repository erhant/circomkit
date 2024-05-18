import {Circomkit, ProofTester} from '../src';
import {PTAU_PATH, prepareMultiplier} from './common';

describe('proof tester', () => {
  const protocol = 'groth16';
  let circuit: ProofTester<['in'], typeof protocol>;
  const {
    circuit: {name, config},
    signals: {input},
  } = prepareMultiplier(3);

  beforeAll(async () => {
    const circomkit = new Circomkit({
      verbose: false,
      logLevel: 'silent',
      protocol,
      circuits: './tests/circuits.json',
      dirPtau: './tests/ptau',
      dirCircuits: './tests/circuits',
      dirInputs: './tests/inputs',
      dirBuild: './tests/build',
    });
    circomkit.instantiate(name, config);
    await circomkit.setup(name, PTAU_PATH);
    circuit = await circomkit.ProofTester(name, protocol);
  });

  it('should verify a proof correctly', async () => {
    const {proof, publicSignals} = await circuit.prove(input);
    await circuit.expectPass(proof, publicSignals);
    expect(await circuit.verify(proof, publicSignals)).toBe(true);
  });

  it('should NOT verify a proof with invalid public signals', async () => {
    const {proof} = await circuit.prove(input);
    await circuit.expectFail(proof, ['1']);
  });
});
