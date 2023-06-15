import {Circomkit, FullProof, ProofTester, WasmTester} from '../dist';

const circomkit = new Circomkit();

describe('multiplier', () => {
  const N = 3;
  const circuitName = `multiplier_${N}`;
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
    const randomNumbers = Array.from({length: N}, () => Math.floor(Math.random() * 100 * N));
    await circuit.expectPass({in: randomNumbers}, {out: randomNumbers.reduce((prev, acc) => acc * prev)});
  });
});

describe('multiplier proofs', () => {
  const N = 3;
  const circuitName = `multiplier_${N}`;
  let circuit: ProofTester<['in']>;
  let fullProof: FullProof;

  before(async () => {
    circuit = await circomkit.ProofTester(circuitName);
    fullProof = await circuit.prove({
      in: Array.from({length: N}, () => Math.floor(Math.random() * 100 * N)),
    });
  });

  it('should verify', async () => {
    await circuit.expectPass(fullProof.proof, fullProof.publicSignals);
  });

  it('should NOT verify', async () => {
    // just give a prime number as the output, assuming none of the inputs are 1
    await circuit.expectFail(fullProof.proof, ['13']);
  });
});
