import {randomBytes} from 'node:crypto';
import {createWriteStream, renameSync, rmSync} from 'node:fs';
import type {IncomingMessage} from 'node:http';
import {get} from 'node:https';
import {pipeline} from 'node:stream/promises';

/** Base PTAU URL as seen in [SnarkJS docs](https://github.com/iden3/snarkjs#7-prepare-phase-2). */
const PTAU_URL_BASE = 'https://circom.info';

/**
 * Returns the name of PTAU file for a given number of constraints.
 * @see https://github.com/iden3/snarkjs#7-prepare-phase-2
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
 * Downloads the phase-1 powers of tau of the Hermez ceremony.
 * @see https://github.com/iden3/snarkjs#7-prepare-phase-2
 * @param ptauName name of PTAU file
 * @param ptauDir directory to download to
 * @returns path to downloaded PTAU file
 */
export async function downloadPtau(ptauName: string, ptauDir: string): Promise<string> {
  const ptauPath = `${ptauDir}/${ptauName}`;
  // downloaded to a temporary file first, so that a failed download is never mistaken for a PTAU file
  // with a unique name, so that concurrent downloads of the same PTAU do not write to the same file
  const tmpPath = `${ptauPath}.${randomBytes(4).toString('hex')}.download`;

  const response = await new Promise<IncomingMessage>((resolve, reject) =>
    get(`${PTAU_URL_BASE}/${ptauName}`, resolve).on('error', reject)
  );
  if (response.statusCode !== 200) {
    response.resume();
    throw new Error(`Could not download ${ptauName}: HTTP ${response.statusCode}`);
  }

  try {
    await pipeline(response, createWriteStream(tmpPath));
  } catch (err) {
    rmSync(tmpPath, {force: true});
    throw err;
  }
  renameSync(tmpPath, ptauPath);
  return ptauPath;
}
