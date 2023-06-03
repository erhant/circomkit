const snarkjs = require('snarkjs');
const wasm_tester = require('circom_tester').wasm;
import {writeFileSync, readFileSync, existsSync, mkdirSync} from 'fs';
import {readFile, rm, writeFile} from 'fs/promises';
import {instantiate} from './utils/instantiate';
import {downloadPtau, getPtauName} from './utils/ptau';
import type {CircuitConfig, R1CSInfoType} from './types/circuit';
import type {CircomkitConfig, CircuitInputPathBuilders, CircuitPathBuilders} from './types/circomkit';

/** Default configurations */
const defaultConfig: Readonly<CircomkitConfig> = {
  proofSystem: 'plonk',
  curve: 'bn128',
  version: '2.1.0',
  silent: false,
  dirs: {
    ptau: './ptau',
    circuits: './circuits',
    inputs: './inputs',
    main: 'main',
    build: './build',
  },
  compiler: {
    optimization: 0,
    verbose: false,
    json: false,
    include: ['./node_modules'],
  },
  colors: {
    title: '\u001b[0;34m', // blue
    log: '\u001b[2;37m', // gray
    error: '\u001b[0;31m', // red
    success: '\u001b[0;32m', // green
  },
};

/**
 * Circomkit is an opinionated wrapper around a few
 * [Snarkjs](../../node_modules/snarkjs/main.js) functions.
 *
 * It abstracts away all the path and commands by providing a simple interface,
 * built around just providing the circuit name and the input name.
 *
 */
export class Circomkit {
  readonly config: CircomkitConfig;

  constructor(overrides: Partial<CircomkitConfig> = {}) {
    // override default options with the user-provided ones
    const config: CircomkitConfig = Object.assign({}, overrides, defaultConfig);

    // sanitize
    this.config = config;
  }

  /** Colorful logging based on config, used by CLI. */
  log(message: string, type: keyof CircomkitConfig['colors'] = 'log') {
    if (!this.config.silent) {
      console.log(`${this.config.colors[type]}${message}\x1b[0m`);
    }
  }

  /** Pretty-print for JSON stringify. */
  private prettyStringify(obj: unknown) {
    return JSON.stringify(obj, undefined, 2);
  }

  /** Parse circuit config from `circuits.json` */
  private readCircuitConfig(circuit: string): CircuitConfig {
    const circuits = JSON.parse(readFileSync('./circuits.json', 'utf-8'));
    if (!(circuit in circuits)) {
      throw new Error('No such circuit in circuits.json');
    }
    return circuits[circuit] as CircuitConfig;
  }

  /**
   * Computes a path that requires a circuit name.
   * @param circuit circuit name
   * @param type path type
   * @returns path
   */
  private path(circuit: string, type: CircuitPathBuilders): string {
    const dir = `${this.config.dirs.build}/${circuit}`;
    switch (type) {
      case 'dir':
        return dir;
      case 'target':
        return `${this.config.dirs.circuits}/${this.config.dirs.main}/${circuit}.circom`;
      case 'pkey':
        return `${dir}/prover_key.zkey`;
      case 'vkey':
        return `${dir}/verifier_key.json`;
      case 'r1cs':
        return `${dir}/${circuit}.r1cs`;
      case 'sym':
        return `${dir}/${circuit}.sym`;
      case 'sol':
        return `${dir}/Verifier_${this.config.proofSystem}.sol`;
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
  private path2(circuit: string, input: string, type: CircuitInputPathBuilders): string {
    const dir = `${this.config.dirs.build}/${circuit}/${input}`;
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
        return `${this.config.dirs.inputs}/${circuit}/${input}.json`;
      default:
        throw new Error('Invalid type: ' + type);
    }
  }

  /** Clean build files and the main component. */
  async clean(circuit: string) {
    await Promise.all([
      rm(this.path(circuit, 'dir'), {recursive: true, force: true}),
      rm(this.path(circuit, 'target'), {force: true}),
    ]);
  }

  /** Information about circuit. */
  async info(circuit: string): Promise<R1CSInfoType> {
    const r1csinfo = await snarkjs.r1cs.info(this.path(circuit, 'r1cs'));
    return {
      variables: r1csinfo.nVars,
      constraints: r1csinfo.nConstraints,
      privateInputs: r1csinfo.nPrvInputs,
      publicInputs: r1csinfo.nPubInputs,
      labels: r1csinfo.nLabels,
      outputs: r1csinfo.nOutputs,
    };
  }

  /** Downloads the ptau file for a circuit based on it's number of constraints. */
  async ptau(circuit: string) {
    const {constraints} = await this.info(circuit);
    const ptauName = getPtauName(constraints);

    // return if ptau exists already
    const ptauPath = `${this.config.dirs.ptau}/${ptauName}`;
    if (existsSync(ptauPath)) {
      return ptauPath;
    } else {
      this.log('Downloading ' + ptauName + '...');
      return await downloadPtau(ptauName, this.config.dirs.ptau);
    }
  }

  /** Compile the circuit.
   * This function uses [wasm tester](../../node_modules/circom_tester/wasm/tester.js)
   * in the background.
   *
   * @returns path to build files
   */
  async compile(circuit: string) {
    const outDir = this.path(circuit, 'dir');
    const targetPath = this.path(circuit, 'target');

    if (!existsSync(targetPath)) {
      this.log('Main component does not exist, creating it now.');
      const path = this.instantiate(circuit);
      this.log('Main component created at: ' + path);
    }

    await wasm_tester(targetPath, {
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

    return outDir;
  }

  /** Exports a solidity contract for the verifier.
   * @returns path to exported Solidity contract
   */
  async contract(circuit: string) {
    const pkey = this.path(circuit, 'pkey');
    const template = readFileSync(
      `./node_modules/snarkjs/templates/verifier_${this.config.proofSystem}.sol.ejs`,
      'utf-8'
    );
    const contractCode = await snarkjs.zKey.exportSolidityVerifier(pkey, {
      [this.config.proofSystem]: template,
    });

    const contractPath = this.path(circuit, 'sol');
    writeFileSync(contractPath, contractCode);
    return contractPath;
  }

  /** Export calldata to console.
   * @returns calldata as a string
   */
  async calldata(circuit: string, input: string) {
    const [pubs, proof] = (
      await Promise.all(
        [this.path2(circuit, input, 'pubs'), this.path2(circuit, input, 'proof')].map(path => readFile(path, 'utf-8'))
      )
    ).map(content => JSON.parse(content));
    return await snarkjs[this.config.proofSystem].exportSolidityCallData(proof, pubs);
  }

  /** Instantiate the `main` component.
   * @returns path to created main component
   */
  instantiate(circuit: string) {
    const circuitConfig = this.readCircuitConfig(circuit);
    const target = instantiate(circuit, {
      ...circuitConfig,
      dir: this.config.dirs.main,
      version: this.config.version,
    });
    return target;
  }

  /** Generate a proof.
   * @returns path to directory where public signals and proof are created
   */
  async prove(circuit: string, input: string) {
    const jsonInput = JSON.parse(readFileSync(this.path2(circuit, input, 'in'), 'utf-8'));
    const fullProof = await snarkjs[this.config.proofSystem].fullProve(
      jsonInput,
      this.path(circuit, 'wasm'),
      this.path(circuit, 'pkey')
    );

    const dir = this.path2(circuit, input, 'dir');
    mkdirSync(dir, {recursive: true});
    await Promise.all([
      writeFile(this.path2(circuit, input, 'pubs'), this.prettyStringify(fullProof.publicSignals)),
      writeFile(this.path2(circuit, input, 'proof'), this.prettyStringify(fullProof.proof)),
    ]);
    return dir;
  }

  /** Commence a circuit-specific setup.
   * @returns path to prover key
   */
  async setup(circuit: string) {
    const r1csPath = this.path(circuit, 'r1cs');
    const pkeyPath = this.path(circuit, 'pkey');
    const vkeyPath = this.path(circuit, 'vkey');

    // create R1CS if needed
    if (!existsSync(r1csPath)) {
      this.log('R1CS does not exist, creating it now...');
      await this.compile(circuit);
    }

    // get ptau path
    this.log('Checking for PTAU file...');
    const ptau = await this.ptau(circuit);

    // circuit specific setup
    if (this.config.proofSystem === 'plonk') {
      await snarkjs.plonk.setup(this.path(circuit, 'r1cs'), ptau, pkeyPath);
    } else {
      throw new Error('Not implemented.');
    }

    // export verification key
    const vkey = await snarkjs.zKey.exportVerificationKey(pkeyPath);
    writeFileSync(vkeyPath, this.prettyStringify(vkey));
    return vkeyPath;
  }

  /** Verify a proof for some public signals. */
  async verify(circuit: string, input: string) {
    const [vkey, pubs, proof] = (
      await Promise.all(
        [this.path(circuit, 'vkey'), this.path2(circuit, input, 'pubs'), this.path2(circuit, input, 'proof')].map(
          path => readFile(path, 'utf-8')
        )
      )
    ).map(content => JSON.parse(content));

    return await snarkjs[this.config.proofSystem].verify(vkey, pubs, proof);
  }

  /** Calculates the witness for the given circuit and input. */
  async witness(circuit: string, input: string) {
    const wasmPath = this.path(circuit, 'wasm');
    const wtnsPath = this.path2(circuit, input, 'wtns');
    const outDir = this.path2(circuit, input, 'dir');
    const jsonInput = JSON.parse(readFileSync(this.path2(circuit, input, 'in'), 'utf-8'));

    mkdirSync(outDir, {recursive: true});
    await snarkjs.wtns.calculate(jsonInput, wasmPath, wtnsPath);
    return wtnsPath;
  }
}
