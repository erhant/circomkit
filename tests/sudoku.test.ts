import {compileCircuit} from '../utils';
import {Circuit} from '../utils/circuit';
import type {FullProof} from '../types/circuit';
import type {WasmTester} from '../types/wasmTester';
import {assert, expect} from 'chai';

const CIRCUIT_NAME = 'sudoku';
describe(CIRCUIT_NAME, () => {
  const INPUT = {
    solution: [
      ['1', '9', '4', '8', '6', '5', '2', '3', '7'],
      ['7', '3', '5', '4', '1', '2', '9', '6', '8'],
      ['8', '6', '2', '3', '9', '7', '1', '4', '5'],
      ['9', '2', '1', '7', '4', '8', '3', '5', '6'],
      ['6', '7', '8', '5', '3', '1', '4', '2', '9'],
      ['4', '5', '3', '9', '2', '6', '8', '7', '1'],
      ['3', '8', '9', '6', '5', '4', '7', '1', '2'],
      ['2', '4', '6', '1', '7', '9', '5', '8', '3'],
      ['5', '1', '7', '2', '8', '3', '6', '9', '4'],
    ],
    puzzle: [
      ['0', '0', '0', '8', '6', '0', '2', '3', '0'],
      ['7', '0', '5', '0', '0', '0', '9', '0', '8'],
      ['0', '6', '0', '3', '0', '7', '0', '4', '0'],
      ['0', '2', '0', '7', '0', '8', '0', '5', '0'],
      ['0', '7', '8', '5', '0', '0', '0', '0', '0'],
      ['4', '0', '0', '9', '0', '6', '0', '7', '0'],
      ['3', '0', '9', '0', '5', '0', '7', '0', '2'],
      ['0', '4', '0', '1', '0', '9', '0', '8', '0'],
      ['5', '0', '7', '0', '8', '0', '0', '9', '4'],
    ],
  };

  describe('functionality', () => {
    let circuit: WasmTester;

    before(async () => {
      circuit = await compileCircuit(CIRCUIT_NAME);
    });

    it('should compute correctly', async () => {
      // compute witness
      const witness = await circuit.calculateWitness(INPUT, true);

      // witness should have valid constraints
      await circuit.checkConstraints(witness);

      // witness should have correct output
      // await circuit.assertOut(witness, {
      //   main: INPUT.puzzle,
      // });
    });
  });

  describe('validation', () => {
    let fullProof: FullProof;

    const circuit = new Circuit(CIRCUIT_NAME);

    before(async () => {
      fullProof = await circuit.prove(INPUT);
    });

    it('should verify', async () => {
      expect(await circuit.verify(fullProof.proof, fullProof.publicSignals)).to.be.true;
    });

    it('should NOT verify a wrong puzzle', async () => {
      // just give a prime number, assuming there are no factors of 1
      // TODO; provide wrong answer
      expect(await circuit.verify(fullProof.proof, ['13'])).to.be.false;
    });
  });
});
