import {Circomkit, type ProofTester, teardown} from '../src';
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
      dirBuild: './tests/build/proof-tester',
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

  it('should prove again after a teardown', async () => {
    await teardown();
    const {proof, publicSignals} = await circuit.prove(input);
    await circuit.expectPass(proof, publicSignals);
    await teardown();
  });

  it('should use the protocol of the config by default', async () => {
    const circomkit = new Circomkit({protocol, dirBuild: './tests/build/proof-tester', logLevel: 'silent'});
    const tester = await circomkit.ProofTester(name);
    expect(tester.protocol).toBe(protocol);
    await expect(circomkit.ProofTester(name, 'plonk')).rejects.toThrow(`is for ${protocol}, not plonk`);
  });
});
