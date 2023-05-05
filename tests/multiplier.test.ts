import {WasmTester, createWasmTester} from '../utils/wasmTester';
import {ProofTester} from '../utils/proofTester';
import type {FullProof} from '../types/circuit';
import {instantiate} from '../utils/instantiate';

describe('multiplier', () => {
  // templates parameters!
  const N = 3;

  // type-safe signal names!
  let circuit: WasmTester<['in'], ['out']>;

  before(async () => {
    const circuitName = `multiplier_${N}`;
    instantiate(circuitName, {
      file: 'multiplier',
      template: 'Multiplier',
      publicInputs: [],
      templateParams: [N],
    });
    circuit = await createWasmTester(circuitName);

    // constraint count checks!
    await circuit.checkConstraintCount(N - 1);
  });

  it('should multiply correctly', async () => {
    const randomNumbers = Array.from({length: N}, () => Math.floor(Math.random() * 100 * N));
    await circuit.expectCorrectAssert(
      {
        in: randomNumbers,
      },
      {
        out: randomNumbers.reduce((prev, acc) => acc * prev),
      }
    );
  });
});

describe('multiplier utilities', () => {
  describe('multiplication gate', () => {
    let circuit: WasmTester<['in'], ['out']>;

    before(async () => {
      const circuitName = 'mulgate';
      instantiate(
        circuitName,
        {
          file: 'multiplier',
          template: 'MultiplicationGate',
          publicInputs: [],
          templateParams: [],
        },
        'test/multiplier'
      );
      circuit = await createWasmTester(circuitName, 'test/multiplier');
    });

    it('should multiply correctly', async () => {
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
  let circuit: ProofTester<['in']>;
  before(async () => {
    const circuitName = 'multiplier_' + N;
    circuit = new ProofTester(circuitName);
    fullProof = await circuit.prove({
      in: Array.from({length: N}, () => Math.floor(Math.random() * 100 * N)),
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
