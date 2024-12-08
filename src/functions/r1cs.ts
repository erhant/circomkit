import {ReadPosition, openSync, readSync} from 'fs';
// @ts-ignore
import * as fastFile from "fastfile";
import type {SymbolsType} from '../types/';
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
    prime: BigInt(0),
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

export async function readSymbols(symFileName: string): Promise<SymbolsType> {
  const fd = await fastFile.readExisting(symFileName);
  const buff = await fd.read(fd.totalSize);
  await fd.close();
  const symsStr = new TextDecoder("utf-8").decode(buff);
  const lines = symsStr.split("\n");
  const out = {};
  for (let i=0; i<lines.length; i++) {
    const arr = lines[i].split(",");
    if (arr.length!=4) continue;
    // @ts-ignore
    out[arr[3]] = {
      labelIdx: Number(arr[0]),
      varIdx: Number(arr[1]),
      componentIdx: Number(arr[2]),
    };
  }
  return out;
}

// @ts-ignore
export function parseConstraints(constraints, symbols, fieldSize): Promise<string[]> {
  // @ts-ignore
  const varsById = Object.entries(symbols).reduce((out, cur) => {
    // @ts-ignore
    const id = cur[1].varIdx;
    if(id !== -1) {
      // @ts-ignore
      out[id] = cur[0].slice(5); // Remove main.
    }
    return out;
  }, {});

  // @ts-ignore
  const parsedConstraints = constraints.map(constraint => {
    // Every constraint is 3 groups: <1> * <2> - <3> = 0
    // @ts-ignore
    const groups = constraint.map(item => {
      // Each group can contain many signals (with coefficients) summed
      const vars = Object.keys(item).reduce((out, cur) => {
        // @ts-ignore
        const coeffRaw = BigInt(item[cur]);
        // Display the coefficient as a signed value, helps a lot with -1
        let coeff = coeffRaw > fieldSize / BigInt(2) ? coeffRaw - fieldSize : coeffRaw;
        // Reduce numbers that are factors of the field size for better readability
        // @ts-ignore
        const modP = BigInt(fieldSize) % BigInt(coeff);
        // XXX: Why within 10000?
        if(modP !== BigInt(0) && modP <= BigInt(10000)) {
          // @ts-ignore
          coeff = `(p-${fieldSize % coeff})/${fieldSize/coeff}`;
        }
        // @ts-ignore
        const varName = varsById[cur];
        out.push(
          // @ts-ignore
          coeff === BigInt(-1) && varName ? '-' + varName :
          coeff === BigInt(1) && varName ? varName :
          !varName ? `${coeff}` :
          `(${coeff} * ${varName})`,
        );
        return out;
      }, []);

      // Combine all the signals into one statement
      return vars.reduce((out, cur, index) =>
        // @ts-ignore
        out + (index > 0 ? cur.startsWith('-') ? ` - ${cur.slice(1)}` : ` + ${cur}` : cur),
        '');
    })
      // @ts-ignore
      .map(curVar => curVar.indexOf(' ') === -1 ? curVar : `(${curVar})`);

    return (
      groups[0] +
      (groups[1] ? ' * ' + groups[1] : '') +
      (groups[2] ?
        groups[2].startsWith('-') ?
          ` + ${groups[2].slice(1)}`
          : groups[0] || groups[1] ?
            ' - ' + groups[2]
            : groups[2].startsWith('(') ?
              groups[2].slice(1, -1)
              : groups[2]
        : '') +
      ' = 0'
    );
  });
  // @ts-ignore
  return parsedConstraints;
}

/** Reads a specified number of bytes from a file and converts them to a `BigInt`.
 *
 * @param offset The position in `buffer` to write the data to.
 * @param length The number of bytes to read.
 * @param position Where to begin reading from in the file.
 */
export function readBytesFromFile(fd: number, offset: number, length: number, position: ReadPosition): BigInt {
  const buffer = Buffer.alloc(length);

  readSync(fd, buffer, offset, length, position);

  return BigInt(`0x${buffer.reverse().toString('hex')}`);
}

// From Snarkjs
// @ts-ignore
export function stringifyBigIntsWithField(Fr, o) {
    if (o instanceof Uint8Array)  {
        return Fr.toString(o);
    } else if (Array.isArray(o)) {
        return o.map(stringifyBigIntsWithField.bind(null, Fr));
    } else if (typeof o == "object") {
        const res = {};
        const keys = Object.keys(o);
        keys.forEach( (k) => {
            // @ts-ignore
            res[k] = stringifyBigIntsWithField(Fr, o[k]);
        });
        return res;
    } else if ((typeof(o) == "bigint") || o.eq !== undefined)  {
        return o.toString(10);
    } else {
        return o;
    }
}
