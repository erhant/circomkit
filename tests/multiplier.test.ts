import {createWasmTester} from '../utils/wasmTester';
import {ProofTester} from '../utils/proofTester';
import type {CircuitSignals, FullProof} from '../types/circuit';
import {assert, expect} from 'chai';
import {instantiate} from '../utils/instantiate';
// read inputs from file
import input80 from '../inputs/multiplier_3/80.json';

const N = 3;

describe('multiplier', () => {
  const INPUT: CircuitSignals = {
    in: [1, 2, 3], // TODO: N random ints
  };

  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    const circuitName = 'multiplier_' + N;
    instantiate(circuitName, 'test', {
      file: 'multiplier',
      template: 'Multiplier',
      publicInputs: [],
      templateParams: [N],
    });
    circuit = await createWasmTester(circuitName, 'test');
    await circuit.printConstraintCount(N); // N - 1
  });

  // after(() => {
  //   clearInstance(circuitName, 'test');
  // });

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
describe.skip('multiplier (proofs)', () => {
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
