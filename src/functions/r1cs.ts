import {closeSync, fstatSync, openSync, readSync} from 'node:fs';
import {StringDecoder} from 'node:string_decoder';
import type {CircomkitConfig} from '../configs';
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
  /** Name of the prime, `undefined` if it is not one of the primes supported by Circom */
  primeName: CircomkitConfig['prime'] | undefined;
};

/** Types of the R1CS file sections that are read, see the [specs](https://github.com/iden3/r1csfile/blob/master/doc/r1cs_bin_format.md) */
const SECTION = {
  HEADER: 1,
  CONSTRAINTS: 2,
  /** PLONK only */
  CUSTOM_GATES: 4,
} as const;

/** Reads an R1CS file in chunks, so that large files are never fully loaded in memory.
 *
 * Follows the specs at [`iden3/r1csfile`](https://github.com/iden3/r1csfile/blob/master/doc/r1cs_bin_format.md):
 * the file is a list of sections that may come in any order, and the header section describes the others.
 */
function readR1CS<T>(r1csPath: string, callback: (r1cs: ReturnType<typeof r1csReader>) => T): T {
  const fd = openSync(r1csPath, 'r');
  try {
    return callback(r1csReader(fd, r1csPath));
  } finally {
    closeSync(fd);
  }
}

function r1csReader(fd: number, r1csPath: string) {
  const chunk = Buffer.alloc(1 << 20);
  let chunkStart = 0; // file position of the chunk
  let chunkLength = 0;
  let position = 0;

  /** Reads `length` bytes at the current position, which are valid until the next read */
  const read = (length: number) => {
    if (position < chunkStart || position + length > chunkStart + chunkLength) {
      chunkStart = position;
      chunkLength = readSync(fd, chunk, 0, chunk.length, position);
      if (chunkLength < length) throw new Error(`Unexpected end of R1CS file: ${r1csPath}`);
    }
    position += length;
    return chunk.subarray(position - length - chunkStart, position - chunkStart);
  };
  const u32 = () => read(4).readUInt32LE();
  const u64 = () => Number(read(8).readBigUInt64LE());
  const toHex = (bytes: Buffer) => Buffer.from(bytes).reverse().toString('hex');

  if (read(4).toString('latin1') !== 'r1cs') throw new Error(`Not an R1CS file: ${r1csPath}`);
  const version = u32();
  if (version !== 1) throw new Error(`Unsupported R1CS version ${version}: ${r1csPath}`);

  const sections = new Map<number, number>(); // type -> data offset
  for (let i = u32(); i > 0; i--) {
    const type = u32();
    const size = u64();
    sections.set(type, position);
    position += size;
  }
  if (position > fstatSync(fd).size) throw new Error(`Unexpected end of R1CS file: ${r1csPath}`);
  const headerOffset = sections.get(SECTION.HEADER);
  if (headerOffset === undefined) throw new Error(`Missing header in R1CS file: ${r1csPath}`);

  position = headerOffset;
  const fieldSize = u32();
  const header = {
    fieldSize,
    prime: BigInt(`0x${toHex(read(fieldSize))}`),
    wires: u32(),
    publicOutputs: u32(),
    publicInputs: u32(),
    privateInputs: u32(),
    labels: u64(),
    constraints: u32(),
  };

  return {
    header,
    sections,
    read,
    u32,
    toHex,
    /** Moves to the data of a section, throwing if it is missing */
    seek(type: number) {
      const offset = sections.get(type);
      if (offset === undefined) throw new Error(`Missing section ${type} in R1CS file: ${r1csPath}`);
      position = offset;
    },
  };
}

/** Read the information about the circuit by extracting it from the R1CS file.
 *
 * @param r1csPath The path to the R1CS file.
 * @returns The information about the circuit, as gathered from the R1CS header.
 */
export async function readR1CSInfo(r1csPath: string): Promise<R1CSInfoType> {
  return readR1CS(r1csPath, ({header, sections, seek, u32}) => {
    // the custom gates section (PLONK only) starts with the number of custom gates
    let useCustomGates = false;
    if (sections.has(SECTION.CUSTOM_GATES)) {
      seek(SECTION.CUSTOM_GATES);
      useCustomGates = u32() > 0;
    }

    const {fieldSize: _, ...info} = header;
    return {...info, useCustomGates, primeName: primeToName[`${header.prime}`]};
  });
}

/** A linear combination, mapping wire indices to their coefficients. */
export type LinearCombination = Map<number, bigint>;

/** The constraints `A * B = C` of a circuit, packed to use little memory.
 *
 * Each constraint has 3 linear combinations `A`, `B` and `C`, so the `k`th constraint has the linear combinations
 * `3k`, `3k + 1` and `3k + 2`. The terms of the `l`th linear combination are at `offsets[l]` to `offsets[l + 1]`.
 *
 * This is the [CSR](https://en.wikipedia.org/wiki/Sparse_matrix#Compressed_sparse_row_(CSR,_CRS_or_Yale_format)) format
 * of a sparse matrix with a row for each linear combination, with the coefficients stored once each.
 */
export type R1CSConstraints = {
  /** Prime of the field */
  prime: bigint;
  /** Where the terms of each linear combination start, and where the last one ends */
  offsets: Uint32Array;
  /** Wire of each term */
  wires: Uint32Array;
  /** Coefficient of each term, as an index into `coefficients` */
  coefficientIds: Uint32Array;
  /** Distinct coefficients, as most terms share a few, e.g. `1` and `-1` */
  coefficients: bigint[];
};

/** Reads the prime and the constraints `A * B = C` from an R1CS file.
 *
 * The file is read in chunks, and the constraints are packed as they are read, see {@link R1CSConstraints}.
 */
export function readR1CSConstraints(r1csPath: string): R1CSConstraints {
  return readR1CS(r1csPath, ({header, read, seek, u32, toHex}) => {
    seek(SECTION.CONSTRAINTS);
    const offsets = [0];
    const wires: number[] = [];
    const coefficientIds: number[] = [];
    const coefficients: bigint[] = [];
    const ids = new Map<string, number>(); // coefficient in hex -> index in `coefficients`
    for (let l = 0; l < 3 * header.constraints; l++) {
      for (let t = u32(); t > 0; t--) {
        wires.push(u32());
        const hex = toHex(read(header.fieldSize));
        let id = ids.get(hex);
        if (id === undefined) {
          id = coefficients.push(BigInt(`0x${hex}`)) - 1;
          ids.set(hex, id);
        }
        coefficientIds.push(id);
      }
      offsets.push(wires.length);
    }

    return {
      prime: header.prime,
      offsets: Uint32Array.from(offsets),
      wires: Uint32Array.from(wires),
      coefficientIds: Uint32Array.from(coefficientIds),
      coefficients,
    };
  });
}

/** Yields the constraints `[A, B, C]` one by one, with their linear combinations as maps. */
export function* iterateConstraints({
  offsets,
  wires,
  coefficientIds,
  coefficients,
}: R1CSConstraints): Generator<[LinearCombination, LinearCombination, LinearCombination]> {
  const linearCombination = (l: number): LinearCombination => {
    const lc: LinearCombination = new Map();
    for (let t = offsets[l]; t < offsets[l + 1]; t++) lc.set(wires[t], coefficients[coefficientIds[t]]);
    return lc;
  };
  for (let l = 0; l < offsets.length - 1; l += 3) {
    yield [linearCombination(l), linearCombination(l + 1), linearCombination(l + 2)];
  }
}

/** Counts the gates that SnarkJS makes for PLONK or FFLONK.
 *
 * Each public signal is a gate, and so is each constraint, plus an addition gate for each term beyond the first
 * in a multiplication, or beyond the third in a linear constraint. A constraint is linear if `A` or `B` is a constant,
 * in which case `A * B - C` is a single linear combination: FFLONK drops the terms that cancel out there, PLONK does not.
 *
 * @see: [`process`](https://github.com/iden3/snarkjs/blob/v0.7.5/src/plonk_setup.js#L270) & [`reduceCoefs`](https://github.com/iden3/snarkjs/blob/v0.7.5/src/plonk_setup.js#L177) for PLONK
 * @see: [`processR1csConstraint`](https://github.com/iden3/snarkjs/blob/v0.7.5/src/r1cs_constraint_processor.js#L32) & [`reduceCoefs`](https://github.com/iden3/snarkjs/blob/v0.7.5/src/r1cs_constraint_processor.js#L127) for FFLONK
 */
export function countPlonkGates(r1cs: R1CSConstraints, publicSignals: number, protocol: 'plonk' | 'fflonk'): number {
  // terms of the wires other than the constant `1` at wire 0
  const variables = (lc: LinearCombination) => lc.size - (lc.has(0) ? 1 : 0);
  const isZero = (lc: LinearCombination) => lc.size === 0;
  const isConstant = (lc: LinearCombination) => lc.size === 1 && lc.has(0);
  const linearGates = (lc: LinearCombination) => 1 + Math.max(0, variables(lc) - 3);

  /** `k * lc + c`, as a single linear combination */
  const join = (k: bigint, lc: LinearCombination, c: LinearCombination) => {
    const sum = new Map(c);
    for (const [wire, coefficient] of lc) sum.set(wire, ((sum.get(wire) ?? 0n) + k * coefficient) % r1cs.prime);
    if (protocol === 'fflonk') for (const [wire, value] of sum) if (value === 0n) sum.delete(wire);
    return sum;
  };

  let gates = publicSignals;
  for (const [a, b, c] of iterateConstraints(r1cs)) {
    if (isZero(a) || isZero(b)) gates += linearGates(c);
    else if (isConstant(a)) gates += linearGates(join(a.get(0) as bigint, b, c));
    else if (isConstant(b)) gates += linearGates(join(b.get(0) as bigint, a, c));
    else gates += 1 + Math.max(0, variables(a) - 1) + Math.max(0, variables(b) - 1) + Math.max(0, variables(c) - 1);
  }
  return gates;
}

/** Yields the symbols of a `.sym` file one by one, with their names, e.g. `main.out`.
 *
 * The file is read in chunks, as it can be longer than the maximum length of a string for large circuits.
 */
export function* iterateSymbols(symPath: string): Generator<[string, SymbolsType[string]]> {
  const fd = openSync(symPath, 'r');
  try {
    const chunk = Buffer.alloc(1 << 20);
    const decoder = new StringDecoder('utf8');
    let rest = ''; // the last line of a chunk may continue in the next one
    for (;;) {
      const length = readSync(fd, chunk, 0, chunk.length, null);
      const lines = (rest + (length > 0 ? decoder.write(chunk.subarray(0, length)) : decoder.end())).split('\n');
      rest = length > 0 ? (lines.pop() ?? '') : '';
      for (const line of lines) {
        const [labelIdx, varIdx, componentIdx, name] = line.split(',');
        if (name === undefined) continue;
        yield [name, {labelIdx: Number(labelIdx), varIdx: Number(varIdx), componentIdx: Number(componentIdx)}];
      }
      if (length === 0) return;
    }
  } finally {
    closeSync(fd);
  }
}

/** Reads all symbols of a `.sym` file, keyed by their names, e.g. `main.out`. */
export function readSymbols(symPath: string): SymbolsType {
  const symbols: SymbolsType = {};
  for (const [name, symbol] of iterateSymbols(symPath)) symbols[name] = symbol;
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
 * The formulas are yielded one by one, so that they can be printed without keeping them all in memory.
 */
export async function* formatConstraints(r1csPath: string, symPath: string, filter?: string): AsyncGenerator<string> {
  const r1cs = readR1CSConstraints(r1csPath);
  const {prime} = r1cs;

  // a wire may have many names after simplification, the shortest one is used
  const names = new Map<number, string>([[0, '1']]); // wire 0 is the constant 1
  const matches = new Set<number>(); // wires of the filter
  filter = filter?.replace(/^main\./, '');
  for (const [symbol, {varIdx: wire}] of iterateSymbols(symPath)) {
    if (wire <= 0) continue; // skip the constant 1, or optimized away (-1)
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
  for (let [a, b, c] of iterateConstraints(r1cs)) {
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
