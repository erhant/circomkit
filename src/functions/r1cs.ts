import {openSync, type ReadPosition, readFileSync, readSync} from 'node:fs';
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
 * Follows the specs at [`iden3/r1csfile`](https://github.com/iden3/r1csfile/blob/master/doc/r1cs_bin_format.md).
 */
export function readR1CSConstraints(r1csPath: string): {
  prime: bigint;
  constraints: [LinearCombination, LinearCombination, LinearCombination][];
} {
  const file = readFileSync(r1csPath);

  // sections may come in any order, the header is needed to read the constraints
  const sections = new Map<number, number>(); // type -> data offset
  for (let i = 0, offset = 12; i < file.readUInt32LE(8); i++) {
    sections.set(file.readUInt32LE(offset), offset + 12);
    offset += 12 + Number(file.readBigUInt64LE(offset + 4));
  }
  const header = sections.get(1);
  const data = sections.get(2);
  if (header === undefined || data === undefined) {
    throw new Error(`Missing header or constraints in R1CS file: ${r1csPath}`);
  }

  const fieldSize = file.readUInt32LE(header);
  const readField = (offset: number) =>
    BigInt(
      `0x${Buffer.from(file.subarray(offset, offset + fieldSize))
        .reverse()
        .toString('hex')}`
    );
  const prime = readField(header + 4);
  const numConstraints = file.readUInt32LE(header + 4 + fieldSize + 24);

  let offset = data;
  const readLinearCombination = (): LinearCombination => {
    const lc: LinearCombination = new Map();
    const numTerms = file.readUInt32LE(offset);
    offset += 4;
    for (let i = 0; i < numTerms; i++) {
      lc.set(file.readUInt32LE(offset), readField(offset + 4));
      offset += 4 + fieldSize;
    }
    return lc;
  };

  const constraints: [LinearCombination, LinearCombination, LinearCombination][] = [];
  for (let i = 0; i < numConstraints; i++) {
    constraints.push([readLinearCombination(), readLinearCombination(), readLinearCombination()]);
  }
  return {prime, constraints};
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
 */
export function formatConstraints(r1csPath: string, symPath: string): string[] {
  const {prime, constraints} = readR1CSConstraints(r1csPath);

  // a wire may have many names after simplification, the shortest one is used
  const names = new Map<number, string>([[0, '1']]); // wire 0 is the constant 1
  for (const [symbol, {varIdx}] of Object.entries(readSymbols(symPath))) {
    const name = symbol.replace(/^main\./, '');
    if (varIdx > 0 && (!names.has(varIdx) || name.length < names.get(varIdx)!.length)) names.set(varIdx, name);
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

  return constraints.map(([a, b, c]) => {
    // A * B - C = 0, shown as `A * B = C` with A positive, or as `C = 0` if there is no multiplication
    if (a.size === 0 || b.size === 0) return `${format(isNegative(c) ? negate(c) : c)} = 0`;
    if (isNegative(a)) [a, c] = [negate(a), negate(c)];
    return `${group(a)} * ${group(b)} = ${format(c)}`;
  });
}
