import {compileCircuit} from '../utils';
import {ProofTester} from '../utils/proofTester';
import type {CircuitSignals, FullProof} from '../types/circuit';
import type {WasmTester} from '../types/wasmTester';
import {assert, expect} from 'chai';
// read inputs from file
import input80 from '../inputs/multiplier3/80.json';

const CIRCUIT_NAME = 'multiplier3';
describe(CIRCUIT_NAME, () => {
  const INPUT: CircuitSignals = input80;

  describe('witness computation', () => {
    let circuit: WasmTester;

    before(async () => {
      circuit = await compileCircuit('./circuits/main/' + CIRCUIT_NAME + '.circom');
      await circuit.loadConstraints();
      console.log('#constraints:', circuit.constraints!.length);
    });

    it('should compute correctly', async () => {
      // compute witness
      const witness = await circuit.calculateWitness(INPUT, true);
      console.log(witness);

      // witness should have valid constraints
      await circuit.checkConstraints(witness);

      // witness should have correct output
      const output = {
        out: BigInt(INPUT.in.reduce((prev: bigint, acc: bigint) => acc * prev)),
      };
      await circuit.assertOut(witness, output);
    });

    it('should NOT compute with wrong number of inputs', async () => {
      try {
        await circuit.calculateWitness(
          {
            in: INPUT.in.slice(1), // fewer inputs
          },
          true
        );
        assert.fail('expected to fail on fewer inputs');
      } catch (err) {}

      try {
        await circuit.calculateWitness(
          {
            in: [2n, ...INPUT.in], // more inputs
          },
          true
        );
        assert.fail('expected to fail on too many inputs');
      } catch (err) {}
    });
  });

  describe('proof verification', () => {
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
});
