import {execFile} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {promisify} from 'node:util';
import type {CircuitConfig} from '../types';

/** Circuit configuration with all fields required, except `overrides` which are not used here. */
export type MainComponentConfig = Required<Omit<CircuitConfig, 'overrides'>>;

import type {CircomkitConfig} from '../configs';

/** Splits `circomPath` into a command and its arguments.
 *
 * `circomPath` may be a command with arguments such as `npx circom2`, unless it is an existing file.
 */
// TODO: Windows `.cmd` shims (e.g. `npx`) need a shell, use the `circom` binary there
function circomCommand(circomPath: string): string[] {
  return existsSync(circomPath) ? [circomPath] : circomPath.split(' ');
}

const circomVersions = new Map<string, Promise<string>>();

/** Returns the version of the Circom compiler at `circomPath`, e.g. `2.2.3`. Cached per path. */
export function circomVersion(circomPath: string): Promise<string> {
  let version = circomVersions.get(circomPath);
  if (!version) {
    const [command, ...args] = circomCommand(circomPath);
    version = promisify(execFile)(command, [...args, '--version']).then(({stdout}) => {
      const match = stdout.match(/(\d+)\.(\d+)\.(\d+)/);
      if (!match) throw new Error(`Could not read the Circom version from: ${stdout}`);
      return match[0];
    });
    circomVersions.set(circomPath, version);
  }
  return version;
}

/** Throws if the Circom compiler at `circomPath` is older than `minimum`, which `feature` requires. */
export async function requireCircom(circomPath: string, minimum: string, feature: string): Promise<void> {
  const version = await circomVersion(circomPath);
  const [a, b] = [version, minimum].map(v => v.split('.').map(Number));
  const older = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  if (older < 0) {
    throw new Error(`${feature} requires Circom ${minimum} or newer, found ${version} (${circomPath})`);
  }
}

/** Compile the circuit using the given configuration.
 *
 * @param config The Circomkit configuration for the compiler.
 * @param targetPath The path to the target circuit file with the main component.
 * @param outDir The output directory for the compiled circuit.
 * @returns The `stdout` and `stderr` of the compilation process.
 */
export async function compileCircuit(config: CircomkitConfig, targetPath: string, outDir: string) {
  mkdirSync(outDir, {recursive: true});

  // arguments are passed as-is without a shell, so paths may contain spaces
  const args = ['--sym', '--r1cs', '-p', config.prime, '-o', outDir];
  for (const path of config.include) args.push('-l', path);
  if (config.verbose) args.push('--verbose');
  if (config.inspect) args.push('--inspect');
  if (config.cWitness) args.push('--c');
  // the C witness calculator's assembly is x86-64 only
  if (config.cWitness && process.arch !== 'x64') {
    await requireCircom(config.circomPath, '2.2.2', `C witness generation on ${process.arch}`);
    args.push('--no_asm');
  }
  if (config.wasmWitness) args.push('--wasm');
  if (typeof config.optimization === 'number') {
    if (config.optimization > 2) {
      // --O2round <value>
      args.push('--O2round', String(config.optimization));
    } else {
      // --O0, --O1 or --O2
      args.push(`--O${config.optimization}`);
    }
  }
  args.push(targetPath);

  const [command, ...commandArgs] = circomCommand(config.circomPath);

  // call `circom` as a sub-process
  try {
    const result = await new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
      execFile(command, [...commandArgs, ...args], {maxBuffer: Infinity}, (error, stdout, stderr) => {
        if (error === null) {
          resolve({stdout, stderr});
        } else {
          reject(error);
        }
      });
    });

    return {...result};
  } catch (e) {
    throw new Error(`Compiler error:\n${e}`);
  }
}

/**
 * Programmatically creates the `main` component of a template circuit.
 * @param config circuit configuration
 * @param targetDir directory to save the circuit file
 * @param targetPath name of the circuit file
 */
export function instantiateCircuit(config: MainComponentConfig, targetDir: string, targetPath: string) {
  const circuitCode = makeCircuit(config);

  // an unchanged file is not rewritten, so that its mtime does not trigger file watchers
  if (existsSync(targetPath) && readFileSync(targetPath, 'utf-8') === circuitCode) {
    return;
  }

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, {recursive: true});
  }

  // written to a unique file first & renamed, so that a concurrent circom does not read a partial file
  const tmpPath = `${targetPath}.tmp-${randomBytes(4).toString('hex')}`;
  writeFileSync(tmpPath, circuitCode);
  renameSync(tmpPath, targetPath);
}

/** Builds the source code for a `main` component based on the circuit config, kind of like `ejs.render`.
 *
 * **Be very careful when editing this file.** */
export function makeCircuit(config: MainComponentConfig) {
  const {version, usesCustomTemplates, file, pubs, template, params} = config;

  return `// auto-generated by circomkit
pragma circom ${version};
${usesCustomTemplates ? 'pragma custom_templates;\n' : ''}
include "../${file}.circom";

component main${pubs.length === 0 ? '' : ` {public[${pubs.join(', ')}]}`} = ${template}(${params.join(', ')});
`;
}

/** Returns `true` if the build artifact exists and is newer than the circuit and every file it includes, recursively.
 *
 * Includes are resolved like Circom does: relative to the including file first, then the `include` directories.
 * An include that can not be found returns `false`, so that the circuit is compiled to be safe.
 *
 * @param artifactPath path to the last file written by compilation, e.g. the WASM file
 * @param circuitPath path to the circuit, e.g. the `main` component
 * @param includeDirs library paths passed to Circom with `-l`
 */
export function isCompiled(artifactPath: string, circuitPath: string, includeDirs: string[]): boolean {
  if (!existsSync(artifactPath)) return false;
  const compiledAt = statSync(artifactPath).mtimeMs;

  const seen = new Set<string>();
  const queue = [resolve(circuitPath)];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (statSync(file).mtimeMs > compiledAt) return false;

    const code = readFileSync(file, 'utf-8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ''); // remove comments
    const includeRegex = /include\s+"([^"]+)"/g;
    for (let match = includeRegex.exec(code); match !== null; match = includeRegex.exec(code)) {
      const include = match[1];
      const found = [dirname(file), ...includeDirs].map(dir => resolve(dir, include)).find(path => existsSync(path));
      if (!found) return false;
      queue.push(found);
    }
  }

  return true;
}
