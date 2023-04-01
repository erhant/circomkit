import {ProofTester} from '../utils/proofTester';
import type {CircuitSignals, FullProof} from '../types/circuit';
import {assert, expect} from 'chai';
// read inputs from file
import input80 from '../inputs/multiplier3/80.json';

const CIRCUIT_NAME = 'multiplier3';
describe(CIRCUIT_NAME + ' (proofs)', () => {
  const INPUT: CircuitSignals = input80;

  let fullProof: FullProof;
  const circuit = new ProofTester(CIRCUIT_NAME);

  before(async () => {
    fullProof = await circuit.prove(INPUT);
  });

  it('should verify', async () => {
    expect(await circuit.verify(fullProof.proof, fullProof.publicSignals)).to.be.true;
  });

  it('should NOT verify a wrong multiplication', async () => {
    // just give a prime number, assuming there are no factors of 1
    expect(await circuit.verify(fullProof.proof, ['13'])).to.be.false;
  });
});
