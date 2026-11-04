import {AssertionError} from 'node:assert';
import {rmSync} from 'node:fs';
import {Circomkit, type WitnessTester} from '../src';
import {primes} from '../src/utils';
import {C_WITNESS} from './common';

// A witness tester computes honest witnesses, but a prover may use any witness that satisfies the constraints.
// These tests edit witnesses as a malicious prover would, to find signals that are not constrained enough.

const dirBuild = './tests/build/soundness';
const circomkit = new Circomkit({
  verbose: false,
  logLevel: 'silent',
  dirCircuits: './tests/circuits',
  dirBuild,
  optimization: 1, // the default of older Circom versions is O2
});

afterAll(() => rmSync(dirBuild, {recursive: true, force: true}));

for (const tester of C_WITNESS ? (['wasm', 'c'] as const) : (['wasm'] as const)) {
  describe(`fake witnesses (${tester})`, () => {
    /** A witness tester of a template in `soundness.circom` */
    const witnessTester = <IN extends string[], OUT extends string[]>(template: string, params: number[] = []) =>
      circomkit.WitnessTester<IN, OUT>(`${template}_${tester}`, {file: 'soundness', template, params}, tester);

    it('should find a missing constraint of IsZero', async () => {
      const safe = await witnessTester<['in'], ['out']>('IsZero');
      const unsafe = await witnessTester<['in'], ['out']>('IsZeroUnsafe');
      // both compute the same honest witnesses
      for (const circuit of [safe, unsafe]) {
        await circuit.expectPass({in: 0}, {out: 1});
        await circuit.expectPass({in: 5}, {out: 0});
      }

      // a prover claims that 5 is zero, with `inv = 0`
      const fake = {'main.inv': 0n, 'main.out': 1n};
      await safe.expectConstraintFail(await safe.editWitness(await safe.calculateWitness({in: 5}), fake));
      await unsafe.expectConstraintPass(await unsafe.editWitness(await unsafe.calculateWitness({in: 5}), fake));
    });

    it('should find missing bit checks of Num2Bits', async () => {
      const safe = await witnessTester<['in'], ['out']>('Num2Bits', [2]);
      const unsafe = await witnessTester<['in'], ['out']>('Num2BitsUnsafe', [2]);
      for (const circuit of [safe, unsafe]) await circuit.expectPass({in: 3}, {out: [1, 1]});

      // 3 = 3 * 1 + 0 * 2, with 3 as a "bit"
      const fake = {'main.out[0]': 3n, 'main.out[1]': 0n};
      await safe.expectConstraintFail(await safe.editWitness(await safe.calculateWitness({in: 3}), fake));
      await unsafe.expectConstraintPass(await unsafe.editWitness(await unsafe.calculateWitness({in: 3}), fake));
    });

    it('should find a signal that is assigned but not constrained', async () => {
      const safe = await witnessTester<['in'], ['out']>('Square');
      const unsafe = await witnessTester<['in'], ['out']>('SquareUnsafe');
      for (const circuit of [safe, unsafe]) await circuit.expectPass({in: 3}, {out: 9});
      await unsafe.expectConstraintCount(0, true);

      const fake = {'main.out': 10n};
      await safe.expectConstraintFail(await safe.editWitness(await safe.calculateWitness({in: 3}), fake));
      await unsafe.expectConstraintPass(await unsafe.editWitness(await unsafe.calculateWitness({in: 3}), fake));
    });

    it('should find a bug within a component', async () => {
      const circuit = await witnessTester<['in'], ['out']>('IsNonZero');
      await circuit.expectPass({in: 5}, {out: 1});

      // the signals of a component are named after it, e.g. `main.isZero.inv`
      const witness = await circuit.calculateWitness({in: 5});
      const fake = await circuit.editWitness(witness, {'main.isZero.inv': 0n, 'main.isZero.out': 1n, 'main.out': 0n});
      await circuit.expectConstraintPass(fake);
      expect(await circuit.readWitnessSignals(fake, ['out', 'isZero.out'])).toEqual({out: 0n, 'isZero.out': 1n});
    });
  });
}

describe('editing witnesses', () => {
  let circuit: WitnessTester<['in'], ['out']>;
  const p = primes.bn128;

  beforeAll(async () => {
    circuit = await circomkit.WitnessTester('num2bits_edit', {file: 'soundness', template: 'Num2Bits', params: [4]});
  });

  it('should not change the given witness', async () => {
    const witness = await circuit.calculateWitness({in: 5});
    const copy = witness.slice();
    const fake = await circuit.editWitness(witness, {'main.out[1]': 1n});
    expect(witness).toEqual(copy);
    expect(fake).not.toEqual(witness);
    await circuit.expectConstraintPass(witness);
  });

  it('should read the edited values', async () => {
    const witness = await circuit.calculateWitness({in: 5});
    expect(await circuit.readWitnessSignals(witness, ['out'])).toEqual({out: [1n, 0n, 1n, 0n]});

    const fake = await circuit.editWitness(witness, {'main.out[0]': 0n, 'main.out[1]': 1n, 'main.in': 6n});
    expect(await circuit.readWitnessSignals(fake, ['in', 'out'])).toEqual({in: 6n, out: [0n, 1n, 1n, 0n]});
    expect(await circuit.readWitness(fake, ['main.out[1]'])).toEqual({'main.out[1]': 1n});
    // 6 in bits, a valid witness for another input
    await circuit.expectConstraintPass(fake);
  });

  it('should treat values as field elements', async () => {
    const witness = await circuit.calculateWitness({in: 5});
    // the same field elements as 1 & 5
    await circuit.expectConstraintPass(await circuit.editWitness(witness, {'main.out[0]': p + 1n, 'main.in': 5n - p}));
    // -1 is p - 1, not a bit
    await circuit.expectConstraintFail(await circuit.editWitness(witness, {'main.out[0]': -1n}));
  });

  it('should throw for unknown symbols', async () => {
    const witness = await circuit.calculateWitness({in: 5});
    await expect(circuit.editWitness(witness, {'main.nope': 1n})).rejects.toThrow('Invalid symbol name: main.nope');
    // symbols are named with `main.`
    await expect(circuit.editWitness(witness, {out: 1n})).rejects.toThrow('Invalid symbol name: out');
  });

  it('should fail the expectations with clear errors', async () => {
    const witness = await circuit.calculateWitness({in: 5});
    const fake = await circuit.editWitness(witness, {'main.out[0]': 0n});

    await expect(circuit.expectConstraintPass(fake)).rejects.toThrow("Constraint doesn't match");
    const error = await circuit.expectConstraintFail(witness).catch(err => err);
    expect(error).toBeInstanceOf(AssertionError);
    expect(error.message).toBe('Expected constraints to not match.');
  });
});
