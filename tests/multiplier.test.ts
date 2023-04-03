import {createWasmTester} from '../utils/wasmTester';
import {ProofTester} from '../utils/proofTester';
import type {CircuitSignals, FullProof} from '../types/circuit';
import {assert, expect} from 'chai';
import {instantiate, clearInstance} from '../utils/instantiate';
// read inputs from file
import input80 from '../inputs/multiplier_3/80.json';

describe('multiplier_3', () => {
  const INPUT: CircuitSignals = input80;

  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    instantiate('multiplier_3', 'test', {
      file: 'multiplier',
      template: 'Multiplier',
      publicInputs: [],
      templateParams: [3],
    });
    circuit = await createWasmTester('multiplier_3', 'test');
    await circuit.printConstraintCount(2); // N - 1
  });

  after(() => {
    clearInstance('multiplier_3', 'test');
  });

  it('should compute correctly', async () => {
    await circuit.expectCorrectAssert(INPUT, {
      out: BigInt(INPUT.in.reduce((prev: bigint, acc: bigint) => acc * prev)),
    });
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
describe.skip('multiplier_3 (proofs)', () => {
  const INPUT: CircuitSignals = input80;

  let fullProof: FullProof;
  let circuit: ProofTester;

  before(async () => {
    circuit = new ProofTester('multiplier_3');
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
