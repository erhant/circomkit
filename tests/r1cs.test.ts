import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import * as snarkjs from 'snarkjs';
import {Circomkit} from '../src';
import {iterateConstraints, iterateSymbols, readR1CSConstraints, readR1CSInfo} from '../src/functions/r1cs';
import {singleThreadOnBun, teardown} from '../src/utils/teardown';

// the R1CS files are read by Circomkit itself, so they are checked against SnarkJS
describe('reading r1cs files', () => {
  const dirBuild = './tests/build/r1cs';
  const circuits = {
    multiplier: {file: 'multiplier', template: 'Multiplier', params: [3]},
    arrays: {file: 'arrays', template: 'Arrays', params: [2, 3], pubs: ['in1D', 'in2D']},
    custom_templates: {file: 'custom_templates', template: 'MyTest'},
  };

  beforeAll(singleThreadOnBun);
  afterAll(async () => {
    await teardown();
    rmSync(dirBuild, {recursive: true, force: true});
  });

  // goldilocks has 8-byte field elements, instead of 32 bytes as in the others
  for (const prime of ['bn128', 'bls12381', 'goldilocks'] as const) {
    for (const optimization of [0, 1, 2]) {
      for (const [name, circuit] of Object.entries(circuits)) {
        it(`should read ${name} with ${prime} at O${optimization}`, async () => {
          const circomkit = new Circomkit({
            verbose: false,
            logLevel: 'silent',
            prime,
            optimization,
            dirCircuits: './tests/circuits',
            dirBuild,
          });
          const circuitName = `${name}_${prime}_o${optimization}`;
          await circomkit.compile(circuitName, {...circuit, dir: 'test'});
          const r1csPath = circomkit.path.ofCircuit(circuitName, 'r1cs');

          const expected = await snarkjs.r1cs.info(r1csPath);
          expect(await readR1CSInfo(r1csPath)).toEqual({
            prime: expected.prime,
            primeName: prime,
            wires: expected.nVars,
            constraints: expected.nConstraints,
            publicOutputs: expected.nOutputs,
            publicInputs: expected.nPubInputs,
            privateInputs: expected.nPrvInputs,
            labels: expected.nLabels,
            useCustomGates: expected.useCustomGates,
          });

          const toObject = (lc: Record<string, unknown>) =>
            Object.fromEntries(Object.entries(lc).map(([wire, coeff]) => [wire, expected.F.toObject(coeff)]));
          const constraints = [...iterateConstraints(readR1CSConstraints(r1csPath))].map(lcs =>
            lcs.map(lc => Object.fromEntries([...lc].map(([wire, coeff]) => [`${wire}`, coeff])))
          );
          expect(constraints).toEqual(expected.constraints.map((lcs: Record<string, unknown>[]) => lcs.map(toObject)));
        });
      }
    }
  }

  describe('broken files', () => {
    const dir = `${dirBuild}/broken`;
    const r1csPath = `${dir}/broken.r1cs`;
    let valid: Buffer;

    beforeAll(async () => {
      const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits: './tests/circuits', dirBuild});
      await circomkit.compile('broken_source', {...circuits.multiplier, dir: 'test'});
      valid = readFileSync(circomkit.path.ofCircuit('broken_source', 'r1cs'));
      mkdirSync(dir, {recursive: true});
    });

    const expectError = async (bytes: Buffer, error: string) => {
      writeFileSync(r1csPath, bytes);
      await expect(readR1CSInfo(r1csPath)).rejects.toThrow(error);
      expect(() => readR1CSConstraints(r1csPath)).toThrow(error);
    };

    it('should throw for truncated files', async () => {
      await expectError(valid.subarray(0, valid.length - 10), 'Unexpected end of R1CS file');
      await expectError(valid.subarray(0, 30), 'Unexpected end of R1CS file');
    });

    it('should throw for other files', async () => {
      await expectError(Buffer.from('{"not": "an r1cs file"}'), 'Not an R1CS file');
      await expectError(
        Buffer.concat([valid.subarray(0, 4), Buffer.from([2, 0, 0, 0]), valid.subarray(8)]),
        'Unsupported R1CS version 2'
      );
    });

    it('should throw for missing sections', async () => {
      // magic, version 1, and no sections
      await expectError(Buffer.concat([valid.subarray(0, 8), Buffer.alloc(4)]), 'Missing header');
    });
  });

  it('should read symbols across chunks', () => {
    // files are read in chunks of 1 MiB, the first line ends with a 2-byte `é` that starts at the last byte of the first chunk
    const first = '0,0,0,main.';
    const lines = [
      `${first}${'x'.repeat(2 ** 20 - 1 - first.length)}é`,
      ...Array.from(
        {length: 60000},
        (_, i) => `${i + 1},${i % 7 === 0 ? -1 : i},${i % 13},main.c[${i}].é${'x'.repeat(i % 17)}`
      ),
    ];
    const symPath = `${dirBuild}/chunks.sym`;
    mkdirSync(dirBuild, {recursive: true});
    writeFileSync(symPath, `${lines.join('\n')}\n`);
    expect(readFileSync(symPath).length).toBeGreaterThan(2 * 2 ** 20);

    const expected = lines.map(line => {
      const [labelIdx, varIdx, componentIdx, name] = line.split(',');
      return [name, {labelIdx: Number(labelIdx), varIdx: Number(varIdx), componentIdx: Number(componentIdx)}];
    });
    expect([...iterateSymbols(symPath)]).toEqual(expected);

    // without a final newline too
    writeFileSync(symPath, lines.join('\n'));
    expect([...iterateSymbols(symPath)]).toEqual(expected);
  });
});
