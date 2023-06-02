const snarkjs = require('snarkjs');
const wasm_tester = require('circom_tester').wasm;
import {type CircomkitConfig, defaultConfig} from './config';
import {writeFileSync, readFileSync, existsSync} from 'fs';
import {mkdirSync} from 'fs';
import {readFile, rm} from 'fs/promises';
import instantiate from './utils/instantiate';
import type {CircuitConfig} from './types/circuit';

/**
 * Circomkit is an opinionated wrapper around a few
 * [Snarkjs](../../node_modules/snarkjs/main.js) functions.
 *
 * It abstracts away all the path and commands by providing a simple interface,
 * built around just providing the circuit name and the input name.
 *
 *
 */
export class Circomkit {
  readonly config: CircomkitConfig;
  private readonly resetColor = '\x1b[0m';

  constructor(overrides: Partial<CircomkitConfig> = {}) {
    // override default options, if any
    this.config = {
      ...defaultConfig,
      ...overrides,
    };
  }

  /** Colorful logging based on config. */
  private log(message: string, type: keyof CircomkitConfig['colors'] = 'log') {
    if (!this.config.silent) {
      console.log(`${this.config.colors[type]}${message}${this.resetColor}`);
    }
  }

  /** Pretty-print for JSON stringify. */
  private prettyStringify(obj: unknown) {
    return JSON.stringify(obj, undefined, 2);
  }

  /**
   * Computes a path that requires a circuit name.
   * @param circuit circuit name
   * @param type path type
   * @returns path
   */
  private path(circuit: string, type: 'target' | 'sym' | 'pkey' | 'vkey' | 'wasm' | 'sol' | 'dir' | 'r1cs'): string {
    const dir = `./build/${circuit}`;
    switch (type) {
      case 'dir':
        return dir;
      case 'target':
        return `./circuits/main/${circuit}.circom`;
      case 'pkey':
        return `${dir}/prover_key.zkey`;
      case 'vkey':
        return `${dir}/verifier_key.json`;
      case 'r1cs':
        return `${dir}/${circuit}.r1cs`;
      case 'sym':
        return `${dir}/${circuit}.sym`;
      case 'sol':
        return `${dir}/Verifier.sol`;
      case 'wasm':
        return `${dir}/${circuit}_js/${circuit}.wasm`;
      default:
        throw new Error('Invalid type: ' + type);
    }
  }

  /**
   * Computes a path that requires a circuit and an input name.
   * @param circuit circuit name
   * @param input input name
   * @param type path type
   * @returns path
   */
  private path2(circuit: string, input: string, type: 'pubs' | 'proof' | 'wtns' | 'in' | 'dir'): string {
    const dir = `./build/${circuit}/${input}`;
    switch (type) {
      case 'dir':
        return dir;
      case 'pubs':
        return `${dir}/public.json`;
      case 'proof':
        return `${dir}/proof.json`;
      case 'wtns':
        return `${dir}/witness.wtns`;
      case 'in':
        return `./inputs/${circuit}/${input}.json`;
      default:
        throw new Error('Invalid type: ' + type);
    }
  }

  /** Clean build files and the main component. */
  async clean(circuit: string) {
    this.log('\n=== Cleaning artifacts ===', 'title');
    await Promise.all([
      rm(this.path(circuit, 'dir'), {recursive: true, force: true}),
      rm(this.path(circuit, 'target'), {force: true}),
    ]);
    this.log('Cleaned.');
  }

  /** Compile the circuit.
   * This function uses [wasm tester](../../node_modules/circom_tester/wasm/tester.js)
   * in the background.
   */
  async compile(circuit: string) {
    this.log('\n=== Compiling the circuit ===', 'title');

    if (!existsSync(this.path(circuit, 'target'))) {
      this.log('Main component does not exist, creating it now.');
      this.instantiate(circuit);
    }

    const outDir = this.path(circuit, 'dir');
    await wasm_tester(this.path(circuit, 'target'), {
      output: outDir,
      prime: this.config.curve,
      verbose: this.config.compiler.verbose,
      O: this.config.compiler.optimization,
      json: this.config.compiler.json,
      include: this.config.compiler.include,
      wasm: true,
      sym: true,
      recompile: true,
    });
    this.log('Built at: ' + outDir);
  }

  /** Exports a solidity contract for the verifier. */
  async contract(circuit: string) {
    this.log('=== Generating verifier contract ===', 'title');

    const pkey = this.path(circuit, 'pkey');
    const verifierCode = await snarkjs.zKey.exportSolidityVerifier(pkey, {
      groth16: readFileSync('./node_modules/snarkjs/templates/verifier_groth16.sol.ejs', 'utf-8'),
      plonk: readFileSync('./node_modules/snarkjs/templates/verifier_plonk.sol.ejs', 'utf-8'),
    });

    const sol = this.path(circuit, 'sol');
    writeFileSync(sol, verifierCode);
    this.log('Contract created at: ' + sol);
  }

  /** Export calldata to console. */
  // async calldata(circuit: string) {
  //   throw new Error('Not implemented.');
  // }

  /** Instantiate the `main` component. */
  instantiate(circuit: string) {
    this.log('\n=== Creating main component ===', 'title');
    const circuits = JSON.parse(readFileSync('./circuits.json', 'utf-8'));
    if (!(circuit in circuits)) {
      throw new Error('No such circuit in circuits.json');
    }
    const circuitConfig = circuits[circuit] as CircuitConfig;
    instantiate(circuit, {
      ...circuitConfig,
      dir: 'main',
      version: this.config.version,
    });
    this.log('Done!');
  }

  /** Generate a proof. */
  async prove(circuit: string, input: string) {
    this.log('=== Generating proof ===', 'title');
    const jsonInput = JSON.parse(readFileSync(this.path2(circuit, input, 'in'), 'utf-8'));
    const fullProof = await snarkjs[this.config.proofSystem].fullProve(
      jsonInput,
      this.path(circuit, 'wasm'),
      this.path(circuit, 'pkey')
    );

    const dir = this.path2(circuit, input, 'dir');
    mkdirSync(dir, {recursive: true});
    writeFileSync(this.path2(circuit, input, 'pubs'), this.prettyStringify(fullProof.publicSignals));
    writeFileSync(this.path2(circuit, input, 'proof'), this.prettyStringify(fullProof.proof));
    this.log('Generated under: ' + dir);
  }

  /** Commence a circuit-specific setup. */
  async setup(circuit: string, ptau: string) {
    this.log('=== Circuit-specific setup ===', 'title');

    const r1csPath = this.path(circuit, 'r1cs');
    const pkeyPath = this.path(circuit, 'pkey');
    const vkeyPath = this.path(circuit, 'vkey');

    // create R1CS if needed
    if (!existsSync(r1csPath)) {
      this.log('R1CS does not exist, creating it now.');
      await this.compile(circuit);
    }

    // circuit specific setup
    if (this.config.proofSystem === 'plonk') {
      await snarkjs.plonk.setup(this.path(circuit, 'r1cs'), ptau, pkeyPath);
    } else {
      throw new Error('Not implemented.');
    }

    // export verification key
    const vkey = await snarkjs.zKey.exportVerificationKey(pkeyPath);
    writeFileSync(vkeyPath, this.prettyStringify(vkey));
    this.log('Prover key created: ' + vkeyPath);
  }

  /**
   * Parse the template circuit that you are using for your main component
   * and generate TypeScript interfaces for it
   */
  // async type(circuit: string) {
  //   throw new Error('Not implemented.');
  // }

  /** Verify a proof for some public signals. */
  async verify(circuit: string, input: string) {
    this.log('=== Verifying proof ===', 'title');

    const [vkey, pubs, proof] = (
      await Promise.all(
        [this.path(circuit, 'vkey'), this.path2(circuit, input, 'pubs'), this.path2(circuit, input, 'proof')].map(
          path => readFile(path, 'utf-8')
        )
      )
    ).map(content => JSON.parse(content));

    const result = await snarkjs[this.config.proofSystem].verify(vkey, pubs, proof);
    if (result) {
      this.log('Verification successful.', 'log');
    } else {
      this.log('Verification failed!', 'error');
    }
  }

  /** Calculates the witness for the given circuit and input. */
  async witness(circuit: string, input: string) {
    this.log('=== Calculating witness ===', 'title');
    const wasmPath = this.path(circuit, 'wasm');
    const wtnsPath = this.path2(circuit, input, 'wtns');
    const outDir = this.path2(circuit, input, 'dir');
    const jsonInput = JSON.parse(readFileSync(this.path2(circuit, input, 'in'), 'utf-8'));

    mkdirSync(outDir, {recursive: true});
    await snarkjs.wtns.calculate(jsonInput, wasmPath, wtnsPath);
    this.log('Created under: ' + wtnsPath);
  }
}
