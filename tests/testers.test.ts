import {Circomkit, ProofTester, WitnessTester} from '../src';
import {BAD_INPUT, CIRCUIT_CONFIG, CIRCUIT_NAME, INPUT, N, OUTPUT} from './common';
import {expect} from 'chai';

describe('witness tester', () => {
  let circuit: WitnessTester<['in'], ['out']>;

  before(async () => {
    const circomkit = new Circomkit({
      verbose: false,
      logLevel: 'silent',
    });
    circuit = await circomkit.WitnessTester(CIRCUIT_NAME, CIRCUIT_CONFIG);
  });

  it('should have correct number of constraints', async () => {
    // N - 1 constraints for each multiplication
    // 1 constraint for the output
    // 4 * N constraints to check if each input is different than 1
    // TOTAL: 5 * N
    await circuit.expectConstraintCount(5 * N, true);
  });

  it('should assert correctly', async () => {
    await circuit.expectPass(INPUT, OUTPUT);
  });

  it('should fail for bad inupt', async () => {
    await circuit.expectFail(BAD_INPUT);
  });

  it('should compute correctly', async () => {
    const output = await circuit.compute(INPUT, ['out']);
    expect(output).to.haveOwnProperty('out');
    expect(output.out).to.eq(BigInt(OUTPUT.out));
  });

  it('should assert for correct witness', async () => {
    const witness = await circuit.calculateWitness(INPUT);
    await circuit.expectConstraintPass(witness);
  });

  it('should NOT assert for bad witness', async () => {
    const witness = await circuit.calculateWitness(INPUT);
    const badWitness = await circuit.editWitness(witness, {
      'main.in[0]': 1n,
      'main.in[1]': 1n,
      'main.in[2]': BigInt(OUTPUT.out),
    });
    await circuit.expectConstraintFail(badWitness);
  });
});

describe('proof tester', () => {
  let circuit: ProofTester<['in']>;

  before(async () => {
    const circomkit = new Circomkit({
      verbose: false,
      logLevel: 'silent',
      protocol: 'plonk',
    });
    circomkit.instantiate(CIRCUIT_NAME, CIRCUIT_CONFIG);
    await circomkit.setup(CIRCUIT_NAME, './ptau/powersOfTau28_hez_final_08.ptau');
    circuit = await circomkit.ProofTester(CIRCUIT_NAME);
  });

  it('should verify a proof correctly', async () => {
    const {proof, publicSignals} = await circuit.prove(INPUT);
    await circuit.expectPass(proof, publicSignals);
  });

  it('should NOT verify a proof with invalid public signals', async () => {
    const {proof} = await circuit.prove(INPUT);
    await circuit.expectFail(proof, ['1']);
  });
});
