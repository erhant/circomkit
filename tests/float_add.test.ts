import {createWasmTester} from '../utils/wasmTester';
import {ProofTester} from '../utils/proofTester';
import type {CircuitSignals, FullProof} from '../types/circuit';
import {assert, expect} from 'chai';

// TODO: write tests
const CIRCUIT_NAME = 'cbl_32';
describe('utils', () => {
  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    circuit = await createWasmTester(CIRCUIT_NAME, 'test');
  });

  it('should compute correctly', async () => {
    const witness = await circuit.calculateWitness(
      {
        in: 3,
      },
      true
    );
    await circuit.checkConstraints(witness);
    await circuit.assertOut(witness, {
      out: 1,
    });
  });
});
