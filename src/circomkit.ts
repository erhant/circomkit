const snarkjs = require('snarkjs');
const wasm_tester = require('circom_tester').wasm;
import {writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, renameSync} from 'fs';
import {readFile, rm, writeFile} from 'fs/promises';
import {instantiate} from './utils/instantiate';
import {downloadPtau, getPtauName} from './utils/ptau';
import type {CircuitConfig, R1CSInfoType} from './types/circuit';
import {Logger, getLogger} from 'loglevel';
import type {
  CircomkitConfig,
  CircomkitConfigOverrides,
  CircuitInputPathBuilders,
  CircuitPathBuilders,
} from './types/circomkit';
import {randomBytes} from 'crypto';
import {CircomWasmTester} from './types/wasmTester';
import WasmTester from './testers/wasmTester';
import ProofTester from './testers/proofTester';

/** Default configurations */
const defaultConfig: Readonly<CircomkitConfig> = {
  proofSystem: 'groth16',
  curve: 'bn128',
  version: '2.1.0',
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
  groth16: {
    numContributions: 1,
    askForEntropy: false,
  },
  logger: {
    logLevel: 'INFO',
    colors: {
      title: '\u001b[0;34m', // blue
      success: '\u001b[0;32m', // green
      info: '\u001b[2;37m', // gray
      trace: '\u001b[2;37m', // gray
      debug: '\u001b[2;37m', // gray
      error: '\u001b[0;31m', // red
      warn: '\u001b[0;33m', // yellow
    },
    verbose: true,
  },
};

/**
 * Circomkit is an opinionated wrapper around many SnarkJS functions.
 *
 * It abstracts away all the path and commands by providing a simple interface,
 * built around just providing the circuit name and the input name.
 *
 * ```ts
 * const circomkit = new Circomkit()
 * ```
 *
 * It also provides a WasmTester and a ProofTester module which uses Chai assertions within.
 *
 * ```ts
 * const wasmTester = circomkit.WasmTester(circuitName, circuitConfig)
 * const proofTester = circomkit.ProofTester(circuitName)
 * ```
 */
export class Circomkit {
  public readonly config: CircomkitConfig;
  public readonly logger: Logger;
  private readonly _logger: Logger | undefined;

  constructor(overrides: CircomkitConfigOverrides = {}) {
    // override default options with the user-provided ones
    const config: CircomkitConfig = Object.assign({}, overrides, defaultConfig);

    this.config = config;
    this.logger = getLogger('Circomkit');
    this.logger.setLevel(config.logger.logLevel);

    // logger for SnarkJS
    this._logger = this.config.logger.verbose ? this.logger : undefined;
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

  /** Colorful logging using the internal logger */
  log(message: string, type: keyof CircomkitConfig['logger']['colors'] = 'info') {
    // TODO: this is very smelly code, find a better way
    if (type === 'title' || type === 'success') {
      this.logger.info(`${this.config.logger.colors[type]}${message}\x1b[0m`);
    } else {
      this.logger[type](`${this.config.logger.colors[type]}${message}\x1b[0m`);
    }
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
  private pathWithInput(circuit: string, input: string, type: CircuitInputPathBuilders): string {
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

  /** Given a PTAU name, returns the relative path. */
  private pathPtau(ptauName: string): string {
    return `${this.config.dirs.ptau}/${ptauName}`;
  }

  /** Given a circuit & id name, returns the relative path to phase-2 PTAU.
   * This is used in particular by Groth16's circuit-specific setup phase.
   */
  private pathZkey(circuit: string, id: number): string {
    return `${this.config.dirs.build}/${circuit}/${circuit}_${id}.zkey`;
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
    const r1csinfo = await snarkjs.r1cs.info(this.path(circuit, 'r1cs'), this._logger);
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
    const ptauPath = this.pathPtau(ptauName);
    if (existsSync(ptauPath)) {
      return ptauPath;
    } else {
      if (this.config.curve !== 'bn128') {
        throw new Error('Auto-downloading PTAU only allowed for bn128 at the moment.');
      }

      mkdirSync(this.config.dirs.ptau, {recursive: true});

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
      this.log('Main component does not exist, creating it now.', 'warn');
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
    const contractCode = await snarkjs.zKey.exportSolidityVerifier(
      pkey,
      {
        [this.config.proofSystem]: template,
      },
      this._logger
    );

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
        (['pubs', 'proof'] as const)
          .map(type => this.pathWithInput(circuit, input, type))
          .map(path => readFile(path, 'utf-8'))
      )
    ).map(content => JSON.parse(content));
    return await snarkjs[this.config.proofSystem].exportSolidityCallData(proof, pubs, this._logger);
  }

  /** Instantiate the `main` component.
   * @returns path to created main component
   */
  instantiate(circuit: string, config?: CircuitConfig) {
    if (config) {
      return instantiate(circuit, config);
    } else {
      const circuitConfig = this.readCircuitConfig(circuit);
      return instantiate(circuit, {
        ...circuitConfig,
        dir: this.config.dirs.main,
        version: this.config.version,
      });
    }
  }

  /** Generate a proof.
   * @returns path to directory where public signals and proof are created
   */
  async prove(circuit: string, input: string) {
    // create WASM if needed
    const wasmPath = this.path(circuit, 'wasm');
    if (!existsSync(wasmPath)) {
      this.log('WASM file does not exist, creating it now...', 'warn');
      await this.compile(circuit);
    }

    // create PKEY if needed
    const pkeyPath = this.path(circuit, 'pkey');
    if (!existsSync(pkeyPath)) {
      this.log('Prover key does not exist, creating it now...', 'warn');
      await this.setup(circuit);
    }

    // check input path
    const inputPath = this.pathWithInput(circuit, input, 'in');
    if (!existsSync(inputPath)) {
      throw new Error('Input does not exist at: ' + inputPath);
    }
    const jsonInput = JSON.parse(readFileSync(inputPath, 'utf-8'));

    const fullProof = await snarkjs[this.config.proofSystem].fullProve(jsonInput, wasmPath, pkeyPath, this._logger);

    const dir = this.pathWithInput(circuit, input, 'dir');
    mkdirSync(dir, {recursive: true});
    await Promise.all([
      writeFile(this.pathWithInput(circuit, input, 'pubs'), this.prettyStringify(fullProof.publicSignals)),
      writeFile(this.pathWithInput(circuit, input, 'proof'), this.prettyStringify(fullProof.proof)),
    ]);
    return dir;
  }

  /** Commence a circuit-specific setup.
   * @returns path to verifier key
   */
  async setup(circuit: string, ptauPath?: string) {
    const r1csPath = this.path(circuit, 'r1cs');
    const pkeyPath = this.path(circuit, 'pkey');
    const vkeyPath = this.path(circuit, 'vkey');

    // create R1CS if needed
    if (!existsSync(r1csPath)) {
      this.log('R1CS does not exist, creating it now...');
      await this.compile(circuit);
    }

    // get ptau path
    if (ptauPath) {
      this.log('Using provided PTAU: ' + ptauPath);
    } else {
      this.log('Checking for PTAU file...');
      ptauPath = await this.ptau(circuit);
    }

    // circuit specific setup
    this.log('Beginning setup phase!');
    if (this.config.proofSystem === 'plonk' || this.config.proofSystem === 'fflonk') {
      // PLONK or FFLONK don't need specific setup
      await snarkjs[this.config.proofSystem].setup(r1csPath, ptauPath, pkeyPath, this._logger);
    } else {
      // Groth16 needs a specific setup with its own PTAU ceremony
      // initialize phase 2
      const ptau2Init = this.pathPtau(`${circuit}_init.zkey`);
      await snarkjs.powersOfTau.preparePhase2(ptauPath, ptau2Init, this._logger);

      // start PTAU generation
      let curZkey = this.pathZkey(circuit, 0);
      await snarkjs.zKey.newZKey(r1csPath, ptau2Init, curZkey, this._logger);
      rmSync(ptau2Init);

      // make contributions
      for (let contrib = 1; contrib <= this.config.groth16.numContributions; contrib++) {
        const nextZkey = this.pathZkey(circuit, contrib);

        // entropy, if user wants to prompt give undefined
        this.log(`Making contribution: ${contrib}`);
        await snarkjs.zKey.contribute(
          curZkey,
          nextZkey,
          `${circuit}_${contrib}`,
          this.config.groth16.askForEntropy ? undefined : randomBytes(32), // entropy
          this._logger
        );

        // remove current key, and move on to next one
        rmSync(curZkey);
        curZkey = nextZkey;
      }

      // finally, rename the resulting key to pkey
      renameSync(curZkey, pkeyPath);
    }

    // export verification key
    const vkey = await snarkjs.zKey.exportVerificationKey(pkeyPath, this._logger);
    writeFileSync(vkeyPath, this.prettyStringify(vkey));
    return vkeyPath;
  }

  /** Verify a proof for some public signals. */
  async verify(circuit: string, input: string) {
    const [vkey, pubs, proof] = (
      await Promise.all(
        [
          this.path(circuit, 'vkey'),
          this.pathWithInput(circuit, input, 'pubs'),
          this.pathWithInput(circuit, input, 'proof'),
        ].map(path => readFile(path, 'utf-8'))
      )
    ).map(content => JSON.parse(content));

    return await snarkjs[this.config.proofSystem].verify(vkey, pubs, proof, this._logger);
  }

  /** Calculates the witness for the given circuit and input. */
  async witness(circuit: string, input: string) {
    const wasmPath = this.path(circuit, 'wasm');
    const wtnsPath = this.pathWithInput(circuit, input, 'wtns');
    const outDir = this.pathWithInput(circuit, input, 'dir');
    const jsonInput = JSON.parse(readFileSync(this.pathWithInput(circuit, input, 'in'), 'utf-8'));

    mkdirSync(outDir, {recursive: true});
    await snarkjs.wtns.calculate(jsonInput, wasmPath, wtnsPath, this._logger);
    return wtnsPath;
  }

  /**
   * Compiles and reutrns a circuit tester class instance.
   * @param circuit name of circuit
   * @param config circuit configuration
   * @returns a `WasmTester` instance
   */
  async WasmTester<IN extends string[] = [], OUT extends string[] = []>(circuit: string, config: CircuitConfig) {
    config.dir ||= 'test';

    // create circuit
    const targetPath = this.instantiate(circuit, config);
    const circomWasmTester: CircomWasmTester = await wasm_tester(targetPath, {
      output: undefined, // todo: check if this is ok
      prime: this.config.curve,
      verbose: this.config.compiler.verbose,
      O: this.config.compiler.optimization,
      json: this.config.compiler.json,
      include: this.config.compiler.include,
      wasm: true,
      sym: true,
      recompile: true,
    });

    return new WasmTester<IN, OUT>(circomWasmTester);
  }

  async ProofTester<IN extends string[] = []>(circuit: string, ptauPath?: string) {
    const wasmPath = this.path(circuit, 'wasm');
    const pkeyPath = this.path(circuit, 'pkey');
    const vkeyPath = this.path(circuit, 'vkey');

    // create keys if required
    if (!existsSync(vkeyPath)) {
      this.log('Verifier key does not exist, creating it now...');
      await this.setup(circuit, ptauPath);
    }

    return new ProofTester<IN>(wasmPath, pkeyPath, vkeyPath);
  }
}
