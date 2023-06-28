import {Circomkit, FullProof, ProofTester, WasmTester} from '../src';
import {expect} from 'chai';

describe('testers with multiplier circuit', () => {
  const circomkit = new Circomkit({
    verbose: false,
  });
  const N = 3;
  const circuitName = `multiplier_${N}`;
  const numbers = Array.from({length: N}, () => Math.floor(Math.random() * 100 * N));
  const product = numbers.reduce((prev, acc) => acc * prev);

  const INPUT = {
    in: numbers,
  };
  const OUTPUT = {
    out: product,
  };

  describe('wasm tester', () => {
    let circuit: WasmTester<['in'], ['out']>;

    before(async () => {
      circuit = await circomkit.WasmTester(circuitName, {
        file: 'multiplier',
        template: 'Multiplier',
        params: [N],
      });
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
      circuit = await circomkit.ProofTester(circuitName);
      fullProof = await circuit.prove(INPUT);
    });

    it('should verify', async () => {
      await circuit.expectPass(fullProof.proof, fullProof.publicSignals);
    });

    it('should NOT verify', async () => {
      // just give a prime number as the output, assuming none of the inputs are 1
      await circuit.expectFail(fullProof.proof, ['13']);
    });
  });
});
