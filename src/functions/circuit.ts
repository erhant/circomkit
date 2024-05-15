import {mkdirSync} from 'fs';
import {exec} from 'child_process';
import {CircomkitConfig} from '../types';

// @todo make compilation config a separate entity derived from CircomkitConfig and be Partial.

/** Compile the circuit using the given configuration.
 *
 * @param config The Circomkit configuration for the compiler.
 * @param targetPath The path to the target circuit file with the main component.
 * @param outDir The output directory for the compiled circuit.
 * @returns The stdout and stderr of the compilation process.
 */
export async function compileCircuit(config: CircomkitConfig, targetPath: string, outDir: string) {
  mkdirSync(outDir, {recursive: true});

  // prettier-ignore
  let flags = `--sym --wasm --r1cs -p ${config.prime} -o ${outDir}`;
  if (config.include.length > 0) flags += ' ' + config.include.map(path => `-l ${path}`).join(' ');
  if (config.verbose) flags += ' --verbose';
  if (config.inspect) flags += ' --inspect';
  if (config.cWitness) flags += ' --c';
  if (config.optimization > 2) {
    // --O2round <value>
    flags += ` --O2round ${config.optimization}`;
  } else {
    // --O0, --O1 or --O2
    flags += ` --O${config.optimization}`;
  }

  // call `circom` as a sub-process
  try {
    const result = await new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
      exec(`${config.circomPath} ${flags} ${targetPath}`, (error, stdout, stderr) => {
        if (error === null) {
          resolve({stdout, stderr});
        } else {
          reject(error);
        }
      });
    });
    // if (config.verbose) {
    //   this.log(result.stdout);
    // }
    // if (result.stderr) {
    //   this.log(result.stderr, 'error');
    // }
    return {...result};
  } catch (e) {
    throw new Error('Compiler error:\n' + e);
  }
}
