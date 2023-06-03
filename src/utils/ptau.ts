import {createWriteStream} from 'fs';
import {get} from 'https';

/** Base PTAU URL as seen in [SnarkJS docs](https://github.com/iden3/snarkjs#7-prepare-phase-2). */
const PTAU_URL_BASE = 'https://hermez.s3-eu-west-1.amazonaws.com';

/**
 * Returns the name of PTAU file for a given number of constraints.
 * @see {@link https://github.com/iden3/snarkjs#7-prepare-phase-2}
 * @param n number of constraints
 * @returns name of the PTAU file
 */
export function getPtauName(n: number): string {
  // smallest p such that 2^p >= n
  const p = Math.ceil(Math.log2(n));

  let id = ''; // default for large values
  if (p < 8) {
    id = '_08';
  } else if (p < 10) {
    id = `_0${p}`;
  } else if (p < 28) {
    id = `_${p}`;
  } else if (p === 28) {
    id = '';
  } else {
    throw new Error('No PTAU for that many constraints!');
  }
  return `powersOfTau28_hez_final${id}.ptau`;
}

/**
 * Downloads phase-1 powers of tau from Polygon Hermez.
 * @param ptauName name of PTAU file
 * @param ptauDir directory to download to
 * @returns path to downloaded PTAU file
 */
export function downloadPtau(ptauName: string, ptauDir: string): Promise<string> {
  const ptauPath = `${ptauDir}/${ptauName}`;
  const file = createWriteStream(ptauPath);
  return new Promise<string>(resolve => {
    get(`${PTAU_URL_BASE}/${ptauName}`, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(ptauPath);
      });
    });
  });
}
