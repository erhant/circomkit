import {createWasmTester} from '../utils/wasmTester';
import {ProofTester} from '../utils/proofTester';
import type {CircuitSignals, FullProof} from '../types/circuit';
import {assert, expect} from 'chai';
// read inputs from file
import input80 from '../inputs/multiplier3/80.json';

const CIRCUIT_NAME = 'multiplier3';
describe(CIRCUIT_NAME, () => {
  const INPUT: CircuitSignals = input80;

  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    circuit = await createWasmTester(CIRCUIT_NAME);
  });

  it('should compute correctly', async () => {
    // compute witness
    const witness = await circuit.calculateWitness(INPUT, true);

    // witness should have valid constraints
    await circuit.checkConstraints(witness);

    // witness should have correct output
    const output = {
      out: BigInt(INPUT.in.reduce((prev: bigint, acc: bigint) => acc * prev)),
    };
    await circuit.assertOut(witness, output);
  });

  it('should NOT compute with wrong number of inputs', async () => {
    const fewInputs = INPUT.in.slice(1);
    await circuit.calculateWitness({in: fewInputs}, true).then(
      () => assert.fail(),
      err => expect(err.message).to.eq('Not enough values for input signal in\n')
    );

    const manyInputs = [2n, ...INPUT.in];
    await circuit.calculateWitness({in: manyInputs}, true).then(
      () => assert.fail(),
      err => expect(err.message).to.eq('Too many values for input signal in\n')
    );
  });
});

// you can also test prover & verifier functions using the actual build files!
describe('multiplier3 (proofs)', () => {
  const INPUT: CircuitSignals = input80;

  let fullProof: FullProof;
  const circuit = new ProofTester('multiplier3');

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
