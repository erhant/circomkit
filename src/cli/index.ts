import * as snarkjs from 'snarkjs';
import {wasm as wasm_tester} from 'circom_tester';
import {CircomkitConfig, defaultConfig} from './config';
import {writeFileSync, readFileSync} from 'fs';
import {mkdirSync, rmSync} from 'fs';
import instantiate from '../utils/instantiate';
import {CircuitConfig} from '../types/circuit';

/**
 * Circomkit is an opinionated wrapper around a few
 * [Snarkjs](../../node_modules/snarkjs/main.js) functions.
 */
export class Circomkit {
  readonly config: CircomkitConfig;
  private readonly resetColor = '\x1b[0m';

  constructor() {
    this.config = defaultConfig;

    // TODO read config from user workspace
  }

  /** Colorful logging based on config. */
  private log(message: string, type: keyof CircomkitConfig['colors'] = 'log') {
    console.log(`${this.config.colors[type]}${message}${this.resetColor}`);
  }

  /**
   * Computes a path that requires a circuit name.
   * @param circuit circuit name
   * @param type path type
   * @returns path
   */
  private path(circuit: string, type: 'target' | 'sym' | 'pkey' | 'vkey' | 'wasm' | 'sol' | 'dir'): string {
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
      case 'sym':
        return `${dir}/symbols.sym`;
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

  /** Clean build files */
  clean(circuit: string) {
    this.log('=== Cleaning artifacts ===', 'title');
    rmSync(this.path(circuit, 'dir'), {recursive: true, force: true});
    rmSync(this.path(circuit, 'target'));
    this.log('All done!');
  }

  /** Compile the circuit */
  async compile(circuit: string) {
    this.instantiate(circuit);

    this.log('=== Compiling the circuit ===', 'title');
    const outDir = this.path(circuit, 'dir');
    await wasm_tester(this.path(circuit, 'target'), {
      output: outDir,
    });
    this.log('Built at: ' + outDir);
  }

  /** Exports a solidity contract for the verifier */
  async contract(circuit: string) {
    this.log('=== Generating verifier contract ===', 'title');

    const pkey = this.path(circuit, 'pkey');
    const verifierCode = await snarkjs.zKey.exportSolidityVerifier(pkey, {
      groth16: './node_modules/snarkjs/templates/verifier_groth16.sol.ejs',
      plonk: './node_modules/snarkjs/templates/verifier_plonk.sol.ejs',
    });
    // TODO: hangs here???
    this.log(verifierCode);

    // output to file
    const sol = this.path(circuit, 'sol');

    this.log('Contract created at: ' + sol);
  }

  /** Instantiate the main component */
  instantiate(circuit: string) {
    this.log('=== Creating main component ===', 'title');
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

  /** Generate a proof */
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
    writeFileSync(this.path2(circuit, input, 'pubs'), JSON.stringify(fullProof.publicSignals, undefined, 2));
    writeFileSync(this.path2(circuit, input, 'proof'), JSON.stringify(fullProof.proof, undefined, 2));
    this.log('Generated under: ' + dir);
  }

  /** Commence a circuit-specific setup */
  setup() {
    throw new Error('Not implemented.');
  }

  /**
   * Parse the template circuit that you are using for your main component
   * and generate TypeScript interfaces for it
   *
   * @deprecated work in progress, do not use
   */
  type() {
    throw new Error('Not implemented.');
  }

  /** Verify a proof for some public signals. */
  async verify(circuit: string, input: string) {
    this.log('=== Verifying proof ===', 'title');

    const vkey = JSON.parse(readFileSync(this.path(circuit, 'vkey'), 'utf-8'));
    const pubs = JSON.parse(readFileSync(this.path2(circuit, input, 'pubs'), 'utf-8'));
    const proof = JSON.parse(readFileSync(this.path2(circuit, input, 'proof'), 'utf-8'));

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
    const jsonInput = JSON.parse(readFileSync(this.path2(circuit, input, 'in'), 'utf-8'));

    const dir = this.path2(circuit, input, 'dir');
    mkdirSync(dir, {recursive: true});
    await snarkjs.wtns.calculate(jsonInput, this.path(circuit, 'wasm'), this.path2(circuit, input, 'wtns'));
    this.log('Created under: ' + dir);
  }
}
