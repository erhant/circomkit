import {execFile} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join, resolve} from 'node:path';
import {promisify} from 'node:util';
import * as snarkjs from 'snarkjs';
import type {CircuitSignals, WitnessType} from '../types';

/** Computes the witness of a circuit for the given input. */
export type WitnessCalculator = (input: CircuitSignals) => Promise<WitnessType>;

/** Path of the C witness calculator binary within the build directory `dir` of `circuit`. */
export function cWitnessCalculatorPath(dir: string, circuit: string): string {
  return join(dir, `${circuit}_cpp`, circuit);
}

/** Builds a witness calculator from the WASM files that Circom generates under `<dir>/<circuit>_js`.
 *
 * The `witness_calculator.js` generated along with the WASM is used, so that it always matches the Circom version.
 */
export async function wasmWitnessCalculator(dir: string, circuit: string): Promise<WitnessCalculator> {
  const jsDir = resolve(dir, `${circuit}_js`);
  const builder = createRequire(`${jsDir}/`)('./witness_calculator.js');
  const calculator = await builder(readFileSync(`${jsDir}/${circuit}.wasm`));
  return input => calculator.calculateWitness(input, false);
}

/** Builds a witness calculator that runs the C witness calculator under `<dir>/<circuit>_cpp`.
 *
 * The binary must be built already, see {@link cWitnessCalculatorPath}.
 */
export function cWitnessCalculator(dir: string, circuit: string): WitnessCalculator {
  const binPath = cWitnessCalculatorPath(dir, circuit);
  return async input => {
    // the binary reads from and writes to files, a random name allows concurrent calls
    const tmpPath = `${binPath}-${randomBytes(4).toString('hex')}`;
    writeFileSync(
      `${tmpPath}.json`,
      JSON.stringify(input, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    );
    try {
      await promisify(execFile)(binPath, [`${tmpPath}.json`, `${tmpPath}.wtns`]);
      return (await snarkjs.wtns.exportJson(`${tmpPath}.wtns`)) as WitnessType;
    } finally {
      rmSync(`${tmpPath}.json`, {force: true});
      rmSync(`${tmpPath}.wtns`, {force: true});
    }
  };
}
