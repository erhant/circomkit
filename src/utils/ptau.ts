import {createWriteStream} from 'fs';
import {get} from 'https';

const PTAU_DIR = './ptau';
const PTAU_URL_BASE = 'https://hermez.s3-eu-west-1.amazonaws.com';

/**
 * Returns the URL of PTAU file for a given power.
 *
 * - If power is larger than 27,
 * @see {@link https://github.com/iden3/snarkjs#7-prepare-phase-2}
 * @param p a number such that numConstraints <= 2^p
 * @returns
 */
function getPtauName(p: number): string {
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
    throw new Error('No PTAU for power level ' + p);
  }
  return `powersOfTau28_hez_final${id}.ptau`;
}

/**
 * Downloads phase-1 powers of tau from Polygon Hermez.
 * @param numConstraints number of constraints in the circuit
 * @returns path to ptau
 */
export function downloadPtau(numConstraints: number): Promise<string> {
  const ptauName = getPtauName(Math.floor(Math.log2(numConstraints)));
  const ptauPath = `${PTAU_DIR}/${ptauName}`;
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
