import {compileCircuit} from '../utils';
import {Circuit} from '../utils/circuit';
import type {CircuitSignals, FullProof} from '../types/circuit';
import type {WasmTester} from '../types/wasmTester';
import {assert, expect} from 'chai';
// read inputs from file
import inputfoo from '../inputs/sudoku9/foo.json';

const CIRCUIT_NAME = 'sudoku9';
describe(CIRCUIT_NAME, () => {
  const INPUT: CircuitSignals = inputfoo;

  describe('functionality', () => {
    let circuit: WasmTester;

    before(async () => {
      circuit = await compileCircuit('./circuits/main/' + CIRCUIT_NAME + '.circom');
      await circuit.loadConstraints();
      console.log('#constraints:', circuit.constraints!.length);
    });

    it('should compute correctly', async () => {
      // compute witness
      const witness = await circuit.calculateWitness(inputfoo, true);

      // witness should have valid constraints
      await circuit.checkConstraints(witness);
    });
  });
});
