import {createWasmTester} from '../utils/wasmTester';
import {ProofTester} from '../utils/proofTester';
import type {FullProof} from '../types/circuit';
import {instantiate} from '../utils/instantiate';

describe('multiplier', () => {
  const N = 3;
  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    const circuitName = 'multiplier_' + N;
    instantiate(circuitName, 'test', {
      file: 'multiplier',
      template: 'Multiplier',
      publicInputs: [],
      templateParams: [N],
    });
    circuit = await createWasmTester<['in'], ['out']>(circuitName, 'test');
    await circuit.printConstraintCount(N - 1);
  });

  it('should compute correctly', async () => {
    const input = {
      in: Array<number>(N)
        .fill(0)
        .map(() => Math.floor(Math.random() * 100 * N)),
    };
    await circuit.expectCorrectAssert(input, {
      out: input.in.reduce((prev, acc) => acc * prev),
    });
  });
});

describe('multiplier utilities', () => {
  describe('multiplication gate', () => {
    let circuit: Awaited<ReturnType<typeof createWasmTester>>;

    before(async () => {
      const circuitName = 'mulgate';
      instantiate(circuitName, 'test/multiplier', {
        file: 'multiplier',
        template: 'MultiplicationGate',
        publicInputs: [],
        templateParams: [],
      });
      circuit = await createWasmTester(circuitName, 'test/multiplier');
    });

    it('should pass for in range', async () => {
      await circuit.expectCorrectAssert(
        {
          in: [7, 5],
        },
        {out: 7 * 5}
      );
    });
  });
});

describe('multiplier proofs', () => {
  const N = 3;

  let fullProof: FullProof;
  let circuit: ProofTester;
  before(async () => {
    const circuitName = 'multiplier_' + N;
    circuit = new ProofTester(circuitName);
    fullProof = await circuit.prove({
      in: Array<number>(N)
        .fill(0)
        .map(() => Math.floor(Math.random() * 100 * N)),
    });
  });

  it('should verify', async () => {
    await circuit.expectVerificationPass(fullProof.proof, fullProof.publicSignals);
  });

  it('should NOT verify a wrong multiplication', async () => {
    // just give a prime number as the output, assuming none of the inputs are 1
    await circuit.expectVerificationFail(fullProof.proof, ['13']);
  });
});
