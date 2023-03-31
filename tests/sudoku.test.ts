import {createWasmTester} from '../utils/wasmTester';
import type {CircuitSignals, FullProof} from '../types/circuit';
import {assert, expect} from 'chai';
// read inputs from file
import inputfoo from '../inputs/sudoku_9x9/example.json';

const CIRCUIT_NAME = 'sudoku9';
describe(CIRCUIT_NAME, () => {
  const INPUT: CircuitSignals = inputfoo;

  describe('witness computation', () => {
    let circuit: Awaited<ReturnType<typeof createWasmTester>>;

    before(async () => {
      circuit = await createWasmTester(CIRCUIT_NAME);
    });

    it('should compute correctly', async () => {
      // compute witness
      const witness = await circuit.calculateWitness(INPUT, true);

      // witness should have valid constraints
      await circuit.checkConstraints(witness);
    });
  });
});
