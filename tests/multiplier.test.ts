import {Circomkit, FullProof, ProofTester, WasmTester} from '../dist';

describe('circomkit testers (via multiplier circuit)', () => {
  const circomkit = new Circomkit();
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

    it('should multiply correctly', async () => {
      await circuit.expectPass(INPUT, OUTPUT);
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
