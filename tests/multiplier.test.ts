import {Circomkit, CircuitConfig, FullProof, ProofTester, WasmTester} from '../src';

function createConfig(n: number): CircuitConfig {
  return {
    file: 'multiplier',
    template: 'Multiplier',
    params: [n],
  };
}

const N = 3;
const circuitName = `multiplier_${N}`;
const circomkit = new Circomkit();

describe('multiplier', () => {
  let circuit: WasmTester<['in'], ['out']>;

  before(async () => {
    circuit = await circomkit.WasmTester(circuitName, createConfig(N));
    await circuit.checkConstraintCount(N);
  });

  it('should multiply correctly', async () => {
    const randomNumbers = Array.from({length: N}, () => Math.floor(Math.random() * 100 * N));
    await circuit.expectPass({in: randomNumbers}, {out: randomNumbers.reduce((prev, acc) => acc * prev)});
  });
});

describe('multiplier proofs', () => {
  let fullProof: FullProof;
  let circuit: ProofTester<['in']>;

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
