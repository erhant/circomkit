import {FullProof, ProofTester, WasmTester} from '../src';

describe('multiplier', () => {
  const N = 3;

  let circuit: WasmTester<['in'], ['out']>;

  before(async () => {
    circuit = await WasmTester.new(`multiplier_${N}`, {
      file: 'multiplier',
      template: 'Multiplier',
      params: [N],
    });

    // constraint count checks!
    await circuit.checkConstraintCount(N - 1);
  });

  it('should multiply correctly', async () => {
    const randomNumbers = Array.from({length: N}, () => Math.floor(Math.random() * 100 * N));
    await circuit.expectPass({in: randomNumbers}, {out: randomNumbers.reduce((prev, acc) => acc * prev)});
  });
});

describe('multiplier utilities', () => {
  describe('multiplication gate', () => {
    let circuit: WasmTester<['in'], ['out']>;

    before(async () => {
      circuit = await WasmTester.new('mulgate', {
        file: 'multiplier',
        template: 'MultiplicationGate',
        dir: 'test/multiplier',
      });
    });

    it('should multiply correctly', async () => {
      await circuit.expectPass({in: [7, 5]}, {out: 7 * 5});
    });
  });
});

describe.skip('multiplier proofs', () => {
  const N = 3;
  let fullProof: FullProof;
  let circuit: ProofTester<['in']>;
  before(async () => {
    const circuitName = 'multiplier_' + N;
    circuit = new ProofTester(circuitName);
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
