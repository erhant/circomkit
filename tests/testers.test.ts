import {Circomkit, FullProof, ProofTester, WasmTester} from '../src';
import {expect} from 'chai';
import {CIRCUIT_CONFIG, CIRCUIT_NAME, INPUT, N, OUTPUT} from './common';

describe('testers', () => {
  const circomkit = new Circomkit({
    verbose: false,
    logLevel: 'silent',
  });

  describe('wasm tester', () => {
    let circuit: WasmTester<['in'], ['out']>;

    before(async () => {
      circuit = await circomkit.WasmTester(CIRCUIT_NAME, CIRCUIT_CONFIG);
      await circuit.checkConstraintCount(N);
    });

    it('should assert correctly', async () => {
      await circuit.expectPass(INPUT, OUTPUT);
    });

    it('should compute correctly', async () => {
      // alternative method to assert outputs
      const output = await circuit.compute(INPUT, ['out']);
      expect(output).to.haveOwnProperty('out');
      expect(output.out).to.eq(BigInt(OUTPUT.out));
    });
  });

  describe('proof tester', () => {
    let circuit: ProofTester<['in']>;
    let fullProof: FullProof;

    before(async () => {
      circuit = await circomkit.ProofTester(CIRCUIT_NAME);
      fullProof = await circuit.prove(INPUT);
    });

    it('should verify', async () => {
      await circuit.expectPass(fullProof.proof, fullProof.publicSignals);
    });

    it('should NOT verify', async () => {
      await circuit.expectFail(fullProof.proof, ['1']);
    });
  });
});
