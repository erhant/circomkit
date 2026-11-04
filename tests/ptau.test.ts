import {execFile} from 'node:child_process';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {promisify} from 'node:util';
import {Circomkit} from '../src';
import {countPlonkGates, readR1CSConstraints} from '../src/functions/r1cs';
import {primes} from '../src/utils';
import {singleThreadOnBun, teardown} from '../src/utils/teardown';

/** A PTAU of 2^8 powers. */
const PTAU_PATH = './tests/ptau/powersOfTau28_hez_final_08.ptau';

type Term = [wire: number, coefficient: bigint];

/** Writes a bn128 R1CS file with the given constraints `A * B = C`. */
function writeR1CS(path: string, publicSignals: number, constraints: [Term[], Term[], Term[]][]) {
  const u32 = (n: number) => Buffer.from(new Uint32Array([n]).buffer);
  const u64 = (n: number) => Buffer.from(new BigUint64Array([BigInt(n)]).buffer);
  const field = (n: bigint) => Buffer.from(n.toString(16).padStart(64, '0'), 'hex').reverse();
  const section = (type: number, data: Buffer) => Buffer.concat([u32(type), u64(data.length), data]);

  const wires = 1 + Math.max(publicSignals, ...constraints.flat(2).map(([wire]) => wire));
  const header = [u32(32), field(primes.bn128), u32(wires), u32(publicSignals), u32(0), u32(0), u64(wires)];
  const lc = (terms: Term[]) => [u32(terms.length), ...terms.flatMap(([wire, k]) => [u32(wire), field(k)])];
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from('r1cs'),
      u32(1),
      u32(3),
      section(1, Buffer.concat([...header, u32(constraints.length)])),
      section(2, Buffer.concat(constraints.flatMap(([a, b, c]) => [...lc(a), ...lc(b), ...lc(c)]))),
      section(3, Buffer.concat(Array.from({length: wires}, (_, i) => u64(i)))),
    ])
  );
}

/** Reads the number of gates from the header of a PLONK or FFLONK zkey. */
function zkeyGates(path: string): number {
  const zkey = readFileSync(path);
  // magic, version & number of sections, then the sections with their type & size
  let position = 12;
  while (zkey.readUInt32LE(position) !== 2) position += 12 + Number(zkey.readBigUInt64LE(position + 4));
  position += 12;
  // the header: n8q, q, n8r, r, nVars, nPublic, domainSize, nAdditions & nConstraints
  position += 4 + zkey.readUInt32LE(position);
  position += 4 + zkey.readUInt32LE(position);
  return zkey.readUInt32LE(position + 16);
}

/** Runs the setup of SnarkJS, which fails if the PTAU is too small.
 *
 * It runs in a child process, as SnarkJS leaves its files open when it fails, which Node 26 & Bun throw for.
 * The child process is always Node, as SnarkJS crashes with its worker threads on Bun.
 */
async function setup(protocol: 'plonk' | 'fflonk', r1csPath: string, zkeyPath: string): Promise<boolean> {
  // PLONK returns -1 on failure, FFLONK throws
  const script = `require('snarkjs')[process.env.PROTOCOL]
    .setup(process.env.R1CS, process.env.PTAU, process.env.ZKEY)
    .then(result => process.exit(result === -1 ? 1 : 0), () => process.exit(1))`;
  const env = {...process.env, PROTOCOL: protocol, R1CS: r1csPath, PTAU: PTAU_PATH, ZKEY: zkeyPath};
  return promisify(execFile)('node', ['-e', script], {env}).then(
    () => true,
    () => false
  );
}

describe('PTAU sizes for PLONK & FFLONK', () => {
  const dirBuild = './tests/build/ptau';
  const dirPtau = `${dirBuild}/ptau`;

  beforeAll(async () => {
    await singleThreadOnBun();
    mkdirSync(dirPtau, {recursive: true});
    // stand-ins, so that `ptau()` returns their path instead of downloading them
    for (const id of ['08', '09']) writeFileSync(`${dirPtau}/powersOfTau28_hez_final_${id}.ptau`, '');
  });
  afterAll(async () => {
    await teardown();
    rmSync(dirBuild, {recursive: true, force: true});
  });

  const circuits = {
    multiplier: {file: 'multiplier', template: 'Multiplier', params: [3]},
    arrays: {file: 'arrays', template: 'Arrays', params: [2, 3], pubs: ['in1D', 'in2D']},
    multiout: {file: 'multiout', template: 'Multiout', params: [3]},
  };
  for (const protocol of ['plonk', 'fflonk'] as const) {
    for (const optimization of [0, 1, 2]) {
      for (const [name, circuit] of Object.entries(circuits)) {
        it(`should count the gates of ${name} at O${optimization} as SnarkJS does for ${protocol}`, async () => {
          const circomkit = new Circomkit({
            verbose: false,
            logLevel: 'silent',
            optimization,
            dirBuild,
            dirCircuits: './tests/circuits',
          });
          const circuitName = `${name}_o${optimization}_${protocol}`;
          await circomkit.compile(circuitName, {...circuit, dir: 'test'});
          const r1csPath = circomkit.path.ofCircuit(circuitName, 'r1cs');
          const zkeyPath = `${dirBuild}/${circuitName}.zkey`;

          const {publicInputs, publicOutputs} = await circomkit.info(circuitName);
          expect(await setup(protocol, r1csPath, zkeyPath)).toBe(true);
          expect(countPlonkGates(readR1CSConstraints(r1csPath), publicInputs + publicOutputs)).toBe(
            zkeyGates(zkeyPath)
          );
        });
      }
    }
  }

  // Circom does not write constraints with a constant `A` or `B`, but SnarkJS reads them as linear constraints
  for (const protocol of ['plonk', 'fflonk'] as const) {
    it(`should count the gates of linear constraints as SnarkJS does for ${protocol}`, async () => {
      const r1csPath = `${dirBuild}/linear_${protocol}.r1cs`;
      const zkeyPath = `${dirBuild}/linear_${protocol}.zkey`;
      const p = primes.bn128;
      const sum: Term[] = [1, 2, 3, 4, 5].map(wire => [wire, BigInt(wire)]);
      writeR1CS(r1csPath, 2, [
        // 3 * sum = C, where the terms of wire 1 cancel out in SnarkJS 0.7.5, which only FFLONK drops
        [
          [[0, 3n]],
          sum,
          [
            [1, p - 3n],
            [6, 1n],
          ],
        ],
        [
          sum,
          [[0, 5n]],
          [
            [2, p - 10n],
            [7, 1n],
            [8, 1n],
          ],
        ],
        // A or B is zero
        [
          [],
          sum,
          [
            [1, 1n],
            [2, 1n],
            [3, 1n],
            [4, 1n],
            [6, 1n],
          ],
        ],
        [sum, [], []],
        // a multiplication, with constants in A & B
        [
          [[0, 1n], ...sum],
          [
            [0, 2n],
            [7, 1n],
            [8, 1n],
          ],
          [
            [6, 1n],
            [9, 1n],
          ],
        ],
      ]);

      expect(await setup(protocol, r1csPath, zkeyPath)).toBe(true);
      const gates = countPlonkGates(readR1CSConstraints(r1csPath), 2);
      expect(gates).toBe(22);
      if (protocol === 'plonk') expect(zkeyGates(zkeyPath)).toBe(gates);
      // an upper bound, as FFLONK drops the terms that cancel out (20 gates in SnarkJS 0.7.5, 22 in 0.7.6)
      else expect(zkeyGates(zkeyPath)).toBeLessThanOrEqual(gates);
    });
  }

  // the PTAU in the tests has 2^8 powers: PLONK fits 256 gates, FFLONK fits a domain of 32, so 30 gates
  for (const [protocol, limit] of [
    ['plonk', 256],
    ['fflonk', 30],
  ] as const) {
    for (const gates of [limit, limit + 1]) {
      it(`should pick the smallest PTAU for ${gates} gates with ${protocol}`, async () => {
        const circomkit = new Circomkit({
          verbose: false,
          logLevel: 'silent',
          protocol,
          dirBuild,
          dirPtau,
          circuits: {},
        });
        const circuit = `gates_${gates}_${protocol}`;
        const r1csPath = circomkit.path.ofCircuit(circuit, 'r1cs');
        mkdirSync(`${dirBuild}/${circuit}`, {recursive: true});
        // a public signal, and multiplications of a single gate each
        writeR1CS(
          r1csPath,
          1,
          Array.from({length: gates - 1}, () => [[[1, 1n]], [[2, 1n]], [[3, 1n]]])
        );

        const fits = await setup(protocol, r1csPath, `${dirBuild}/${circuit}.zkey`);
        expect(fits).toBe(gates === limit);
        expect(await circomkit.ptau(circuit)).toMatch(fits ? /_08\.ptau$/ : /_09\.ptau$/);
      });
    }
  }
});
