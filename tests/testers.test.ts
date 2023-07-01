import {Circomkit, ProofTester, WitnessTester} from '../src';
import {expect} from 'chai';
import {CIRCUIT_CONFIG, CIRCUIT_NAME, INPUT, N, OUTPUT} from './common';

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
    expect(await circuit.getConstraintCount()).to.eq(N);
  });

  it('should assert correctly', async () => {
    await circuit.expectPass(INPUT, OUTPUT);
  });

  it('should compute correctly', async () => {
    const output = await circuit.compute(INPUT, ['out']);
    expect(output).to.haveOwnProperty('out');
    expect(output.out).to.eq(BigInt(OUTPUT.out));
  });

  it('should assert for correct witness', async () => {
    const witness = await circuit.calculateWitness(INPUT);
    await circuit.expectConstraintsPass(witness);
  });

  it('should NOT assert for bad witness', async () => {
    const witness = await circuit.calculateWitness(INPUT);
    const badWitness = await circuit.editWitness(witness, {
      'main.inner[0]': 99999n,
    });
    await circuit.expectConstraintsFail(badWitness);
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
