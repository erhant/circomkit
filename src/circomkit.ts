const snarkjs = require('snarkjs');
const wasm_tester = require('circom_tester').wasm;
import {writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, renameSync} from 'fs';
import {readFile, rm, writeFile} from 'fs/promises';
import {instantiate} from './utils/instantiate';
import {downloadPtau, getPtauName} from './utils/ptau';
import type {CircuitConfig, CircuitSignals, R1CSInfoType} from './types/circuit';
import {Logger, getLogger} from 'loglevel';
import type {
  CircomkitConfig,
  CircomkitConfigOverrides,
  CircuitInputPathBuilders,
  CircuitPathBuilders,
} from './types/circomkit';
import {randomBytes} from 'crypto';
import {CircomWasmTester} from './types/circom_tester';
import WitnessTester from './testers/witnessTester';
import ProofTester from './testers/proofTester';
import {prettyStringify, primeToName} from './utils';
import {defaultConfig, colors, CURVES, PROTOCOLS} from './utils/config';

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
 * It also provides a **WitnessTester** and a **ProofTester** module which uses Chai assertions within.
 *
 * ```ts
 * const witnessTester = await circomkit.WitnessTester(circuitName, circuitConfig)
 * const proofTester = await circomkit.ProofTester(circuitName)
 * ```
 */
export class Circomkit {
  public readonly config: CircomkitConfig;
  public readonly logger: Logger;
  private readonly _logger: Logger | undefined;

  constructor(overrides: CircomkitConfigOverrides = {}) {
    // override default options with the user-provided ones
    // we can do this via two simple spreads because both objects are single depth
    const config: CircomkitConfig = {
      ...defaultConfig,
      ...overrides,
    };

    this.config = JSON.parse(JSON.stringify(config)) as CircomkitConfig;
    this.logger = getLogger('Circomkit');
    this.logger.setLevel(this.config.logLevel);

    // logger for SnarkJS
    this._logger = this.config.verbose ? this.logger : undefined;

    // sanity check for prime and protocol
    if (!CURVES.includes(this.config.prime)) {
      throw new Error('Invalid prime in configuration.');
    }
    if (!PROTOCOLS.includes(this.config.protocol)) {
      throw new Error('Invalid protocol in configuration.');
    }
  }

  /** Parse circuit config from `circuits.json` */
  private readCircuitConfig(circuit: string): CircuitConfig {
    const circuits = JSON.parse(readFileSync(this.config.circuits, 'utf-8'));
    if (!(circuit in circuits)) {
      throw new Error('No such circuit in ' + this.config.circuits);
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
    const dir = `${this.config.dirBuild}/${circuit}`;
    switch (type) {
      case 'dir':
        return dir;
      case 'target':
        return `${this.config.dirCircuits}/main/${circuit}.circom`;
      case 'r1cs':
        return `${dir}/${circuit}.r1cs`;
      case 'sym':
        return `${dir}/${circuit}.sym`;
      case 'wasm':
        return `${dir}/${circuit}_js/${circuit}.wasm`;
      case 'pkey':
        return `${dir}/${this.config.protocol}_pkey.zkey`;
      case 'vkey':
        return `${dir}/${this.config.protocol}_vkey.json`;
      case 'sol':
        return `${dir}/${this.config.protocol}_verifier.sol`;
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
    const dir = `${this.config.dirBuild}/${circuit}/${input}`;
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
        return `${this.config.dirInputs}/${circuit}/${input}.json`;
      default:
        throw new Error('Invalid type: ' + type);
    }
  }

  /** Given a PTAU name, returns the relative path. */
  private pathPtau(ptauName: string): string {
    return `${this.config.dirPtau}/${ptauName}`;
  }

  /** Given a circuit & id name, returns the relative path to phase-2 PTAU.
   * This is used in particular by Groth16's circuit-specific setup phase.
   */
  private pathZkey(circuit: string, id: number): string {
    return `${this.config.dirBuild}/${circuit}/${circuit}_${id}.zkey`;
  }

  /** Colorful logging using the internal logger */
  log(message: string, type: keyof typeof colors = 'info') {
    // TODO: this is very smelly code, find a better way
    if (type === 'title' || type === 'success') {
      this.logger.info(`${colors[type]}${message}\x1b[0m`);
    } else {
      this.logger[type](`${colors[type]}${message}\x1b[0m`);
    }
  }

  /** Clean build files and the main component. */
  async clean(circuit: string): Promise<void> {
    await Promise.all([
      rm(this.path(circuit, 'dir'), {recursive: true, force: true}),
      rm(this.path(circuit, 'target'), {force: true}),
    ]);
  }

  /** Information about circuit. */
  async info(circuit: string): Promise<R1CSInfoType> {
    // we do not pass this._logger here on purpose
    const r1csinfo = await snarkjs.r1cs.info(this.path(circuit, 'r1cs'), undefined);
    return {
      variables: r1csinfo.nVars,
      constraints: r1csinfo.nConstraints,
      privateInputs: r1csinfo.nPrvInputs,
      publicInputs: r1csinfo.nPubInputs,
      labels: r1csinfo.nLabels,
      outputs: r1csinfo.nOutputs,
      prime: r1csinfo.prime,
      primeName: primeToName[r1csinfo.prime],
    };
  }

  /** Downloads the ptau file for a circuit based on it's number of constraints. */
  async ptau(circuit: string): Promise<string> {
    if (this.config.prime !== 'bn128') {
      throw new Error('Auto-downloading PTAU only allowed for bn128 at the moment.');
    }
    const {constraints} = await this.info(circuit);
    const ptauName = getPtauName(constraints);

    // return if ptau exists already
    const ptauPath = this.pathPtau(ptauName);
    if (existsSync(ptauPath)) {
      return ptauPath;
    } else {
      mkdirSync(this.config.dirPtau, {recursive: true});

      this.log('Downloading ' + ptauName + '...');
      return await downloadPtau(ptauName, this.config.dirPtau);
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

    const path = this.instantiate(circuit);
    this.log('Main component created at: ' + path, 'debug');

    await wasm_tester(targetPath, {
      output: outDir,
      prime: this.config.prime,
      verbose: this.config.verbose,
      O: this.config.optimization,
      json: false,
      include: this.config.include,
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
    const template = readFileSync(`./node_modules/snarkjs/templates/verifier_${this.config.protocol}.sol.ejs`, 'utf-8');
    const contractCode = await snarkjs.zKey.exportSolidityVerifier(
      pkey,
      {
        [this.config.protocol]: template,
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
  async calldata(circuit: string, input: string): Promise<string> {
    // fflonk gives error (tested at snarkjs v0.7.0)
    if (this.config.protocol === 'fflonk') {
      throw new Error('Exporting calldata is not supported for fflonk yet.');
    }
    const [pubs, proof] = (
      await Promise.all(
        (['pubs', 'proof'] as const)
          .map(type => this.pathWithInput(circuit, input, type))
          .map(path => readFile(path, 'utf-8'))
      )
    ).map(content => JSON.parse(content));
    return await snarkjs[this.config.protocol].exportSolidityCallData(proof, pubs, this._logger);
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
        dir: 'main',
        version: this.config.version,
      });
    }
  }

  /** Generate a proof.
   * @returns path to directory where public signals and proof are created
   */
  async prove(circuit: string, input: string): Promise<string> {
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

    const fullProof = await snarkjs[this.config.protocol].fullProve(jsonInput, wasmPath, pkeyPath, this._logger);

    const dir = this.pathWithInput(circuit, input, 'dir');
    mkdirSync(dir, {recursive: true});
    await Promise.all([
      writeFile(this.pathWithInput(circuit, input, 'pubs'), prettyStringify(fullProof.publicSignals)),
      writeFile(this.pathWithInput(circuit, input, 'proof'), prettyStringify(fullProof.proof)),
    ]);
    return dir;
  }

  /** Commence a circuit-specific setup.
   * @returns path to verifier key and prover key
   */
  async setup(circuit: string, ptauPath?: string): Promise<{proverKeyPath: string; verifierKeyPath: string}> {
    const r1csPath = this.path(circuit, 'r1cs');
    const pkeyPath = this.path(circuit, 'pkey');
    const vkeyPath = this.path(circuit, 'vkey');

    // create R1CS if needed
    if (!existsSync(r1csPath)) {
      this.log('R1CS does not exist, creating it now...', 'warn');
      await this.compile(circuit);
    }

    // get ptau path
    if (ptauPath === undefined) {
      if (this.config.prime !== 'bn128') {
        throw new Error('Please provide PTAU file when using a prime field other than bn128');
      }
      this.log('Checking for PTAU file...', 'debug');
      ptauPath = await this.ptau(circuit);
    }

    // circuit specific setup
    this.log('Beginning setup phase!', 'info');
    if (this.config.protocol === 'groth16') {
      // Groth16 needs a specific setup with its own PTAU ceremony
      // initialize phase 2
      const ptau2Init = this.pathPtau(`${circuit}_init.zkey`);
      await snarkjs.powersOfTau.preparePhase2(ptauPath, ptau2Init, this._logger);

      // start PTAU generation
      let curZkey = this.pathZkey(circuit, 0);
      await snarkjs.zKey.newZKey(r1csPath, ptau2Init, curZkey, this._logger);
      rmSync(ptau2Init);

      // make contributions
      for (let contrib = 1; contrib <= this.config.groth16numContributions; contrib++) {
        const nextZkey = this.pathZkey(circuit, contrib);

        // entropy, if user wants to prompt give undefined
        this.log(`Making contribution: ${contrib}`, 'info');
        await snarkjs.zKey.contribute(
          curZkey,
          nextZkey,
          `${circuit}_${contrib}`,
          this.config.groth16askForEntropy ? undefined : randomBytes(32), // entropy
          this._logger
        );

        // remove current key, and move on to next one
        rmSync(curZkey);
        curZkey = nextZkey;
      }

      // finally, rename the resulting key to pkey
      renameSync(curZkey, pkeyPath);
    } else {
      // PLONK or FFLONK don't need specific setup
      await snarkjs[this.config.protocol].setup(r1csPath, ptauPath, pkeyPath, this._logger);
    }

    // export verification key
    const vkey = await snarkjs.zKey.exportVerificationKey(pkeyPath, this._logger);
    writeFileSync(vkeyPath, prettyStringify(vkey));
    return {verifierKeyPath: vkeyPath, proverKeyPath: pkeyPath};
  }

  /** Verify a proof for some public signals.
   * @returns `true` if verification is successful, `false` otherwise.
   */
  async verify(circuit: string, input: string): Promise<boolean> {
    const [vkey, pubs, proof] = (
      await Promise.all(
        [
          this.path(circuit, 'vkey'),
          this.pathWithInput(circuit, input, 'pubs'),
          this.pathWithInput(circuit, input, 'proof'),
        ].map(path => readFile(path, 'utf-8'))
      )
    ).map(content => JSON.parse(content));

    return await snarkjs[this.config.protocol].verify(vkey, pubs, proof, this._logger);
  }

  /** Calculates the witness for the given circuit and input.
   * @returns path to created witness
   */
  async witness(circuit: string, input: string): Promise<string> {
    const wasmPath = this.path(circuit, 'wasm');
    const wtnsPath = this.pathWithInput(circuit, input, 'wtns');
    const outDir = this.pathWithInput(circuit, input, 'dir');
    const jsonInput = JSON.parse(readFileSync(this.pathWithInput(circuit, input, 'in'), 'utf-8'));

    mkdirSync(outDir, {recursive: true});
    await snarkjs.wtns.calculate(jsonInput, wasmPath, wtnsPath, this._logger);
    return wtnsPath;
  }

  /** Exports a JSON input file for some circuit with the given object.
   * This is useful for testing real circuits, or creating an input programmatically.
   * Overwrites an existing input.
   * @returns path to created input file
   */
  input(circuit: string, input: string, data: CircuitSignals): string {
    const inputPath = this.pathWithInput(circuit, input, 'in');
    writeFileSync(inputPath, prettyStringify(data));
    return inputPath;
  }

  /**
   * Export a circuit artifact in JSON format. If the last argument `write` is true, it will write to
   * file with the appropriate path, and return the path. Otheriwse, returns the JSON obejct.
   * @param type type of file to export
   * @returns a JSON object or the path that it would be exported to.
   */
  async json(type: 'r1cs' | 'zkey' | 'wtns', circuit: string, input?: string): Promise<{json: object; path: string}> {
    let json: object;
    let path: string;

    switch (type) {
      // R1CS
      case 'r1cs': {
        path = this.path(circuit, 'r1cs');
        json = await snarkjs.r1cs.exportJson(path, undefined); // internal log didnt make sense
        break;
      }
      // Prover key
      case 'zkey': {
        // must be groth16, others give error (tested at snarkjs v0.7.0)
        if (this.config.protocol !== 'groth16') {
          throw new Error('Exporting zKey to JSON only supported for groth16 at the moment.');
        }

        path = this.path(circuit, 'pkey');
        json = await snarkjs.zKey.exportJson(path, undefined); // does not take logger
        break;
      }
      // Witness
      case 'wtns': {
        if (!input) throw new Error('Expected input');
        path = this.pathWithInput(circuit, input, 'wtns');
        json = await snarkjs.wtns.exportJson(path, undefined); // does not take logger
        break;
      }
      default:
        throw new Error('Unknown export target: ' + type);
    }

    return {
      json,
      path: path + '.json',
    };
  }

  /**
   * Compiles the circuit and reutrns a circuit tester.
   * @param circuit name of circuit
   * @param config circuit configuration
   * @returns a `WitnessTester` instance
   */
  async WitnessTester<IN extends string[] = [], OUT extends string[] = []>(circuit: string, config: CircuitConfig) {
    config.dir ||= 'test';

    // create circuit
    const targetPath = this.instantiate(circuit, config);
    const circomWasmTester: CircomWasmTester = await wasm_tester(targetPath, {
      output: undefined, // todo: check if this is ok
      prime: this.config.prime,
      verbose: this.config.verbose,
      O: this.config.optimization,
      json: false,
      include: this.config.include,
      wasm: true,
      sym: true,
      recompile: true,
    });

    return new WitnessTester<IN, OUT>(circomWasmTester);
  }

  /**
   * Creates a ProofTester.
   * @param circuit circuit name
   * @param ptauPath optional path to PTAU file
   * @returns a ProofTester
   */
  async ProofTester<IN extends string[] = []>(circuit: string, ptauPath?: string) {
    const wasmPath = this.path(circuit, 'wasm');
    const pkeyPath = this.path(circuit, 'pkey');
    const vkeyPath = this.path(circuit, 'vkey');

    // create keys if required
    if (!existsSync(vkeyPath)) {
      this.log('Verifier key does not exist, creating it now...', 'debug');
      await this.setup(circuit, ptauPath);
    }

    return new ProofTester<IN>(wasmPath, pkeyPath, vkeyPath);
  }
}
