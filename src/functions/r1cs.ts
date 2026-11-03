import {closeSync, createReadStream, openSync, type ReadPosition, readFileSync, readSync} from 'node:fs';
import {createInterface} from 'node:readline';
import type {SymbolsType} from '../types';
import {primeToName} from '../utils';

/**
 * Some fields for the R1CS information, many other fields are omitted in this type.
 */
export type R1CSInfoType = {
  wires: number;
  constraints: number;
  privateInputs: number;
  publicInputs: number;
  publicOutputs: number;
  useCustomGates: boolean;
  labels: number;
  prime: bigint;
  primeName: string;
};

/** Read the information about the circuit by extracting it from the R1CS file.
 *
 * This implementation follows the specs at [`iden3/r1csfile`](https://github.com/iden3/r1csfile/blob/master/doc/r1cs_bin_format.md)
 * and is inspired from the work by [PSE's `p0tion`](https://github.com/privacy-scaling-explorations/p0tion/blob/f88bcee5d499dce975d0592ed10b21aa8d73bbd2/packages/actions/src/helpers/utils.ts#L413)
 * and by [Weijiekoh's `circom-helper`](https://github.com/weijiekoh/circom-helper/blob/master/ts/read_num_inputs.ts#L5).
 *
 * @param r1csPath The path to the R1CS file.
 * @returns The information about the circuit, as gathered from the R1CS header.
 */
export async function readR1CSInfo(r1csPath: string): Promise<R1CSInfoType> {
  let pointer = 0;

  const r1csInfoType: R1CSInfoType = {
    wires: 0,
    constraints: 0,
    privateInputs: 0,
    publicInputs: 0,
    publicOutputs: 0,
    useCustomGates: false,
    labels: 0,
    prime: 0n,
    primeName: '',
  };

  // open the file (read mode).
  const fd = openSync(r1csPath, 'r');

  // get 'number of section' (jump magic r1cs and version1 data).
  const numberOfSections = readBytesFromFile(fd, 0, 4, 8);
  pointer = 12;

  for (let i = Number(numberOfSections); i >= 0; i--) {
    const sectionType = Number(readBytesFromFile(fd, 0, 4, pointer));
    pointer += 4;

    const sectionSize = Number(readBytesFromFile(fd, 0, 8, pointer));
    pointer += 8;

    // @todo the docs of `read` indicate that if pointer is `null`, the pointer will actually move w.r.t length
    // we may actually use that instead of adding to point as done below

    switch (sectionType) {
      // header section.
      case 1:
        // field size (skip).
        pointer += 4;

        r1csInfoType.prime = readBytesFromFile(fd, 0, 32, pointer).toString() as unknown as bigint;
        pointer += 32;

        r1csInfoType.wires = Number(readBytesFromFile(fd, 0, 4, pointer));
        pointer += 4;

        r1csInfoType.publicOutputs = Number(readBytesFromFile(fd, 0, 4, pointer));
        pointer += 4;

        r1csInfoType.publicInputs = Number(readBytesFromFile(fd, 0, 4, pointer));
        pointer += 4;

        r1csInfoType.privateInputs = Number(readBytesFromFile(fd, 0, 4, pointer));
        pointer += 4;

        r1csInfoType.labels = Number(readBytesFromFile(fd, 0, 8, pointer));
        pointer += 8;

        r1csInfoType.constraints = Number(readBytesFromFile(fd, 0, 4, pointer));
        pointer += 4;
        break;
      // custom gates list section (plonk only).
      case 4:
        r1csInfoType.useCustomGates = Number(readBytesFromFile(fd, 0, 4, pointer)) > 0;

        pointer += Number(sectionSize);
        break;
      default:
        pointer += Number(sectionSize);
        break;
    }
  }

  r1csInfoType.primeName = primeToName[r1csInfoType.prime.toString() as `${bigint}`];
  return r1csInfoType;
}

/** A linear combination, mapping wire indices to their coefficients. */
export type LinearCombination = Map<number, bigint>;

/** Reads the prime and the constraints `A * B = C` from an R1CS file.
 *
 * The constraints are read lazily in chunks, so that large circuits are never fully loaded in memory.
 * Follows the specs at [`iden3/r1csfile`](https://github.com/iden3/r1csfile/blob/master/doc/r1cs_bin_format.md).
 */
export function readR1CSConstraints(r1csPath: string): {
  prime: bigint;
  constraints: Generator<[LinearCombination, LinearCombination, LinearCombination]>;
} {
  const toBigInt = (bytes: Buffer) => BigInt(`0x${Buffer.from(bytes).reverse().toString('hex')}`);

  // sections may come in any order, the header is needed to read the constraints
  const fd = openSync(r1csPath, 'r');
  const sections = new Map<number, number>(); // type -> data offset
  let fieldSize: number;
  let prime: bigint;
  let numConstraints: number;
  try {
    const at = (position: number, length: number) => {
      const bytes = Buffer.alloc(length);
      readSync(fd, bytes, 0, length, position);
      return bytes;
    };
    for (let i = 0, offset = 12, n = at(8, 4).readUInt32LE(); i < n; i++) {
      const section = at(offset, 12);
      sections.set(section.readUInt32LE(0), offset + 12);
      offset += 12 + Number(section.readBigUInt64LE(4));
    }
    const header = sections.get(1);
    if (header === undefined || !sections.has(2)) {
      throw new Error(`Missing header or constraints in R1CS file: ${r1csPath}`);
    }
    fieldSize = at(header, 4).readUInt32LE();
    prime = toBigInt(at(header + 4, fieldSize));
    numConstraints = at(header + 4 + fieldSize + 24, 4).readUInt32LE();
  } finally {
    closeSync(fd);
  }

  function* constraints(): Generator<[LinearCombination, LinearCombination, LinearCombination]> {
    const fd = openSync(r1csPath, 'r');
    try {
      const chunk = Buffer.alloc(Math.max(1 << 20, fieldSize));
      let chunkStart = 0; // file position of the chunk
      let chunkLength = 0;
      let position = sections.get(2)!;
      const read = (length: number) => {
        if (position + length > chunkStart + chunkLength) {
          chunkStart = position;
          chunkLength = readSync(fd, chunk, 0, chunk.length, position);
          if (chunkLength < length) throw new Error(`Unexpected end of R1CS file: ${r1csPath}`);
        }
        position += length;
        return chunk.subarray(position - length - chunkStart, position - chunkStart);
      };
      const readLinearCombination = (): LinearCombination => {
        const lc: LinearCombination = new Map();
        for (let i = read(4).readUInt32LE(); i > 0; i--) {
          const wire = read(4).readUInt32LE();
          lc.set(wire, toBigInt(read(fieldSize)));
        }
        return lc;
      };

      for (let i = 0; i < numConstraints; i++) {
        yield [readLinearCombination(), readLinearCombination(), readLinearCombination()];
      }
    } finally {
      closeSync(fd);
    }
  }

  return {prime, constraints: constraints()};
}

/** Reads a specified number of bytes from a file and converts them to a `BigInt`.
 *
 * @param offset The position in `buffer` to write the data to.
 * @param length The number of bytes to read.
 * @param position Where to begin reading from in the file.
 */
export function readBytesFromFile(fd: number, offset: number, length: number, position: ReadPosition): bigint {
  const buffer = Buffer.alloc(length);

  readSync(fd, buffer, offset, length, position);

  return BigInt(`0x${buffer.reverse().toString('hex')}`);
}

/** Reads all symbols of a `.sym` file, keyed by their names, e.g. `main.out`. */
export function readSymbols(symPath: string): SymbolsType {
  const symbols: SymbolsType = {};
  for (const line of readFileSync(symPath, 'utf-8').split('\n')) {
    const [labelIdx, varIdx, componentIdx, symbolName] = line.split(',');
    if (symbolName === undefined) continue;
    symbols[symbolName] = {labelIdx: Number(labelIdx), varIdx: Number(varIdx), componentIdx: Number(componentIdx)};
  }
  return symbols;
}

/** Formats the constraints of a circuit as human-readable formulas, e.g. `in[0] * in[1] = inner[0]`.
 *
 * Signals are named as in the `main` component, coefficients are shown signed (`p - 1` as `-1`),
 * and constraints without a multiplication are shown as `... = 0`.
 *
 * With a `filter`, only the constraints using that signal or component (e.g. `isZero[0]` for `isZero[0].in`)
 * are formatted, prefixed with their index like `#3: ...`.
 *
 * Both files are streamed, so the constraints can be printed as they are formatted.
 */
export async function* formatConstraints(r1csPath: string, symPath: string, filter?: string): AsyncGenerator<string> {
  const {prime, constraints} = readR1CSConstraints(r1csPath);

  // a wire may have many names after simplification, the shortest one is used
  const names = new Map<number, string>([[0, '1']]); // wire 0 is the constant 1
  const matches = new Set<number>(); // wires of the filter
  filter = filter?.replace(/^main\./, '');
  for await (const line of createInterface({input: createReadStream(symPath), crlfDelay: Infinity})) {
    const [, varIdx, , symbol] = line.split(',');
    const wire = Number(varIdx);
    if (symbol === undefined || !(wire > 0)) continue;
    const name = symbol.replace(/^main\./, '');
    if (!names.has(wire) || name.length < names.get(wire)!.length) names.set(wire, name);
    if (filter !== undefined && (name === filter || name.startsWith(`${filter}.`) || name.startsWith(`${filter}[`))) {
      matches.add(wire);
    }
  }
  if (filter !== undefined && matches.size === 0) {
    throw new Error(`No signal matches ${filter}, it may not exist or was optimized away`);
  }

  const signed = (c: bigint) => (c > prime / 2n ? c - prime : c);
  const negate = (lc: LinearCombination): LinearCombination =>
    new Map([...lc].map(([i, c]) => [i, (prime - c) % prime]));

  // terms in wire order with the constant last, formatted like `a - 2 * b + 3`
  const terms = (lc: LinearCombination) => [...lc].sort(([i], [j]) => (i === 0 ? 1 : j === 0 ? -1 : i - j));
  const format = (lc: LinearCombination) => {
    const formatted = terms(lc).map(([i, coeff], k) => {
      const c = signed(coeff);
      const abs = c < 0n ? -c : c;
      const term = i === 0 ? `${abs}` : abs === 1n ? names.get(i)! : `${abs} * ${names.get(i)!}`;
      return k === 0 ? (c < 0n ? `-${term}` : term) : `${c < 0n ? ' - ' : ' + '}${term}`;
    });
    return formatted.join('') || '0';
  };
  const isNegative = (lc: LinearCombination) => lc.size > 0 && signed(terms(lc)[0][1]) < 0n;
  const group = (lc: LinearCombination) => (lc.size > 1 ? `(${format(lc)})` : format(lc));

  let index = 0;
  for (let [a, b, c] of constraints) {
    const i = index++;
    if (filter !== undefined && ![a, b, c].some(lc => [...lc.keys()].some(wire => matches.has(wire)))) continue;

    // A * B - C = 0, shown as `A * B = C` with A positive, or as `C = 0` if there is no multiplication
    let formatted: string;
    if (a.size === 0 || b.size === 0) {
      formatted = `${format(isNegative(c) ? negate(c) : c)} = 0`;
    } else {
      if (isNegative(a)) [a, c] = [negate(a), negate(c)];
      formatted = `${group(a)} * ${group(b)} = ${format(c)}`;
    }
    yield filter === undefined ? formatted : `#${i}: ${formatted}`;
  }
}
