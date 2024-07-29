import * as snarkjs from 'snarkjs';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import {wasm as wasm_tester} from 'circom_tester';
import {writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, renameSync} from 'fs';
import {readFile, rm, writeFile} from 'fs/promises';
import {randomBytes} from 'crypto';
import loglevel from 'loglevel';
import {downloadPtau, getPtauName} from '../utils/ptau';
import type {CircuitConfig, CircuitSignals, CircomWasmTester} from '../types';
import {WitnessTester, ProofTester} from '../testers';
import {prettyStringify} from '../utils';
import {CircomkitConfig, DEFAULT, PRIMES, PROTOCOLS} from '../configs';
import {compileCircuit, instantiateCircuit, readR1CSInfo, getCalldata} from '../functions';
import {CircomkitPath} from './pathing';

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
 * It also provides a **WitnessTester** and a **ProofTester** module which use Chai assertions within.
 *
 * ```ts
 * const witnessTester = await circomkit.WitnessTester(circuitName, circuitConfig)
 * const proofTester = await circomkit.ProofTester(circuitName)
 * ```
 */
export class Circomkit {
  public readonly config: CircomkitConfig;
  public readonly log: loglevel.Logger;
  public readonly path: CircomkitPath;

  /** A logger reference to be passed into SnarkJS functions. If `verbose` is set to `false`, this logger will be undefined. */
  private readonly snarkjsLogger: loglevel.Logger | undefined;

  constructor(overrides: Partial<CircomkitConfig> = {}) {
    // override default options with the user-provided ones
    // we can do this via two simple spreads because both objects are single depth
    const config: CircomkitConfig = {
      ...DEFAULT,
      ...overrides,
    };

    this.config = JSON.parse(JSON.stringify(config)) as CircomkitConfig;
    this.log = loglevel.getLogger('Circomkit');
    this.log.setLevel(this.config.logLevel);

    // logger for SnarkJS, accepted as an optional argument within their functions
    this.snarkjsLogger = this.config.verbose ? this.log : undefined;

    // sanity checks
    if (!PRIMES.includes(this.config.prime)) {
      throw new Error('Invalid prime in configuration.');
    }
    if (!PROTOCOLS.includes(this.config.protocol)) {
      throw new Error('Invalid protocol in configuration.');
    }
    if (this.config.optimization < 0) {
      this.log.warn('Optimization level must be at least 0, setting it to 0.');
      this.config.optimization = 0;
    }

    // PLONK protocol requires optimization level to be 1
    if (this.config.protocol === 'plonk' && this.config.optimization !== 1) {
      this.log.warn(
        'Optimization level for PLONK must be 1.\n',
        'See: https://docs.circom.io/circom-language/circom-insight/simplification/'
      );
      this.config.optimization = 1;
    }

    this.path = new CircomkitPath(this.config);
  }

  /** Returns the contents of `circuits.json`. */
  readCircuits(): Record<string, CircuitConfig> {
    return JSON.parse(readFileSync(this.config.circuits, 'utf-8'));
  }

  /** Returns a single circuit config from `circuits.json`. */
  readCircuitConfig(circuit: string): CircuitConfig {
    const circuits = this.readCircuits();
    if (!(circuit in circuits)) {
      throw new Error('No such circuit in ' + this.config.circuits);
    }
    return circuits[circuit] as CircuitConfig;
  }

  /** Clear build files and the `main` component of a circuit. */
  async clear(circuit: string): Promise<void> {
    await Promise.all([
      rm(this.path.ofCircuit(circuit, 'dir'), {recursive: true, force: true}),
      rm(this.path.ofCircuit(circuit, 'main'), {force: true}),
    ]);
  }

  /** Export a verification key (vKey) from a proving key (zKey). */
  async vkey(circuit: string, pkeyPath?: string): Promise<string> {
    const vkeyPath = this.path.ofCircuit(circuit, 'vkey');

    // check if it exists
    if (pkeyPath === undefined) {
      pkeyPath = this.path.ofCircuit(circuit, 'pkey');
    }

    if (!existsSync(pkeyPath)) {
      throw new Error('There must be a prover key for this circuit to extract a verification key.');
    }

    // extract it
    const vkey = await snarkjs.zKey.exportVerificationKey(pkeyPath, this.snarkjsLogger);
    writeFileSync(vkeyPath, prettyStringify(vkey));

    return vkeyPath;
  }

  /** Returns circuit information. */
  async info(circuit: string) {
    return await readR1CSInfo(this.path.ofCircuit(circuit, 'r1cs'));
  }

  /** Downloads the phase-1 setup PTAU file for a circuit based on it's number of constraints.
   *
   * The downloaded PTAU files can be seen at [SnarkJS docs](https://github.com/iden3/snarkjs#7-prepare-phase-2).
   * Note that this may take a while if the circuit is large and thus a larger PTAU is needed.
   *
   * This function only works when the used prime is `bn128`.
   *
   * @returns path of the downloaded PTAU file
   */
  async ptau(circuit: string): Promise<string> {
    // @todo check for performance gains when larger PTAUs are found instead of the target PTAU
    const {constraints} = await this.info(circuit);
    const ptauName = getPtauName(constraints);
    const ptauPath = this.path.ofPtau(ptauName);

    if (existsSync(ptauPath)) {
      // return if ptau exists already
      return ptauPath;
    } else {
      /// otherwise download it
      if (this.config.prime !== 'bn128') {
        throw new Error('Auto-downloading PTAU only allowed for bn128 at the moment.');
      }

      mkdirSync(this.config.dirPtau, {recursive: true});

      this.log.info(`Downloading ${ptauName}, this may take a while.`);
      return await downloadPtau(ptauName, this.config.dirPtau);
    }
  }

  /** Compile the circuit.
   *
   * A circuit configuration can be passed optionally; if not, the
   * config will be read from `circuits.json` at the working directory.
   *
   * @returns path of the build directory
   */
  async compile(circuit: string, config?: CircuitConfig) {
    const targetPath = this.instantiate(circuit, config);
    this.log.debug('Main component created at: ' + targetPath);

    const outDir = this.path.ofCircuit(circuit, 'dir');

    const {stdout, stderr} = await compileCircuit(this.config, targetPath, outDir);
    if (this.config.verbose) {
      this.log.info(stdout);
    }
    if (stderr) {
      this.log.error(stderr);
    }
    return outDir;
  }

  /** Exports a solidity contract for the verifier.
   * @returns path of the exported Solidity contract
   */
  async contract(circuit: string) {
    const pkey = this.path.ofCircuit(circuit, 'pkey');
    const template = readFileSync(`./node_modules/snarkjs/templates/verifier_${this.config.protocol}.sol.ejs`, 'utf-8');
    const contractCode = await snarkjs.zKey.exportSolidityVerifier(
      pkey,
      {[this.config.protocol]: template},
      this.snarkjsLogger
    );

    const contractPath = this.path.ofCircuit(circuit, 'sol');
    writeFileSync(contractPath, contractCode);
    return contractPath;
  }

  /** Export calldata to call a Verifier contract.
   *
   * @returns calldata
   */
  async calldata(circuit: string, input: string, pretty?: boolean): Promise<string> {
    const pubs: snarkjs.PublicSignals = JSON.parse(
      await readFile(this.path.ofCircuitWithInput(circuit, input, 'pubs'), 'utf-8')
    );
    const proof: snarkjs.Groth16Proof & snarkjs.PlonkProof & snarkjs.FflonkProof = JSON.parse(
      await readFile(this.path.ofCircuitWithInput(circuit, input, 'proof'), 'utf-8')
    );

    const res = getCalldata(proof, pubs, pretty ?? this.config.prettyCalldata);
    return res;
  }

  /** Instantiate the `main` component.
   *
   * If `circuitConfig` argument is omitted, this function will look for it at `circuits.json`
   * in the working directory, and throw an error if no entry is found for the circuit.
   *
   * When config is read from file, `dir` defaults to `main`, otherwise `dir` defaults to `test`.
   * This is done to make it so that when CLI is used circuits are created under `main`, and when
   * we use Circomkit programmatically (e.g. during testing) circuits are created under `test`
   * unless specified otherwise.
   *
   * @returns path of the created main component
   */
  instantiate(circuit: string, circuitConfig?: CircuitConfig) {
    if (!circuitConfig) {
      const circuitConfigFile = this.readCircuitConfig(circuit);
      circuitConfig = {
        ...circuitConfigFile,
        dir: circuitConfigFile.dir || 'main',
        version: circuitConfigFile.version || this.config.version,
      };
    }

    const circomSource = readFileSync(`${this.config.dirCircuits}/${circuitConfig.file}.circom`, 'utf8');
    const usesCustomTemplates = circomSource
      .replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '') // Remove single and multi-line comments
      .includes('pragma custom_templates;');

    // directory to output the file
    const directory = circuitConfig.dir || 'test';

    // add "../" to the filename in include, one for each "/" in directory name
    // if none, the prefix becomes empty string
    const filePrefixMatches = directory.match(/\//g);
    let file = circuitConfig.file;
    if (filePrefixMatches !== null) {
      file = '../'.repeat(filePrefixMatches.length) + file;
    }

    const config = {
      file: file,
      template: circuitConfig.template,
      version: circuitConfig.version || '2.0.0',
      usesCustomTemplates,
      dir: directory,
      pubs: circuitConfig.pubs || [],
      params: circuitConfig.params || [],
    };

    const targetDir = `${this.config.dirCircuits}/${directory}`;
    const targetPath = `${targetDir}/${circuit}.circom`;

    instantiateCircuit(config, targetDir, targetPath);

    return targetPath;
  }

  /** Generate a proof.
   *
   * If `data` is not passed, the input data will be read from `inputs/<circuit>/<input>.json`.
   *
   * @returns path of the directory where public signals and proof are created
   */
  async prove(circuit: string, input: string, data?: CircuitSignals): Promise<string> {
    // create WASM if needed
    const wasmPath = this.path.ofCircuit(circuit, 'wasm');
    if (!existsSync(wasmPath)) {
      this.log.warn('WASM file does not exist, creating it now...');
      await this.compile(circuit);
    }

    // create PKEY if needed
    const pkeyPath = this.path.ofCircuit(circuit, 'pkey');
    if (!existsSync(pkeyPath)) {
      this.log.warn('Prover key does not exist, creating it now...');
      await this.setup(circuit);
    }

    const jsonInput = data ?? JSON.parse(readFileSync(this.path.ofCircuitWithInput(circuit, input, 'in'), 'utf-8'));

    const {proof, publicSignals} = await snarkjs[this.config.protocol].fullProve(
      jsonInput,
      wasmPath,
      pkeyPath,
      this.snarkjsLogger
    );

    const dir = this.path.ofCircuitWithInput(circuit, input, 'dir');
    mkdirSync(dir, {recursive: true});
    await Promise.all([
      writeFile(this.path.ofCircuitWithInput(circuit, input, 'pubs'), prettyStringify(publicSignals)),
      writeFile(this.path.ofCircuitWithInput(circuit, input, 'proof'), prettyStringify(proof)),
    ]);
    return dir;
  }

  /** Commence a circuit-specific setup.
   *
   * If `ptauPath` argument is omitted, this function will try to automatically download it.
   * See the {@link ptau} method for more information about this.
   *
   * @returns path of the verifier key and prover key
   */
  async setup(circuit: string, ptauPath?: string): Promise<{proverKeyPath: string; verifierKeyPath: string}> {
    const r1csPath = this.path.ofCircuit(circuit, 'r1cs');
    const pkeyPath = this.path.ofCircuit(circuit, 'pkey');
    const vkeyPath = this.path.ofCircuit(circuit, 'vkey');

    // create R1CS if needed
    if (!existsSync(r1csPath)) {
      this.log.warn('R1CS does not exist, creating it now.');
      await this.compile(circuit);
    }

    // get ptau path
    if (ptauPath === undefined) {
      this.log.info('No PTAU was provided, downloading it.');
      // if no ptau is given, we can download it
      if (this.config.prime !== 'bn128') {
        throw new Error('Can not download PTAU file when using a prime field other than bn128');
      }
      ptauPath = await this.ptau(circuit);
    } else if (!existsSync(ptauPath)) {
      // if the provided path does not exist, we can download it anyways
      this.log.warn('PTAU path was given but no PTAU exists there, downloading it anyways.');
      ptauPath = await this.ptau(circuit);
    }

    // circuit specific setup
    this.log.info('Beginning setup phase!');
    if (this.config.protocol === 'groth16') {
      // Groth16 needs a circuit specific setup

      // generate genesis zKey
      let curZkey = this.path.ofZkey(circuit, 0);
      await snarkjs.zKey.newZKey(r1csPath, ptauPath, curZkey, this.snarkjsLogger);

      // make contributions
      for (let contrib = 1; contrib <= this.config.groth16numContributions; contrib++) {
        const nextZkey = this.path.ofZkey(circuit, contrib);

        // entropy, if user wants to prompt give undefined
        this.log.info(`Making contribution: ${contrib}`);
        await snarkjs.zKey.contribute(
          curZkey,
          nextZkey,
          `${circuit}_${contrib}`,
          this.config.groth16askForEntropy ? undefined : randomBytes(32), // entropy
          this.snarkjsLogger
        );

        // remove current key, and move on to next one
        rmSync(curZkey);
        curZkey = nextZkey;
      }

      // finally, rename the resulting key to pkey
      renameSync(curZkey, pkeyPath);
    } else {
      // PLONK or FFLONK don't need specific setup
      await snarkjs[this.config.protocol].setup(r1csPath, ptauPath, pkeyPath, this.snarkjsLogger);
    }

    // export verification key
    const vkey = await snarkjs.zKey.exportVerificationKey(pkeyPath, this.snarkjsLogger);
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
          this.path.ofCircuit(circuit, 'vkey'),
          this.path.ofCircuitWithInput(circuit, input, 'pubs'),
          this.path.ofCircuitWithInput(circuit, input, 'proof'),
        ].map(path => readFile(path, 'utf-8'))
      )
    ).map(content => JSON.parse(content));

    return await snarkjs[this.config.protocol].verify(vkey, pubs, proof, this.snarkjsLogger);
  }

  /** Calculates the witness for the given circuit and input.
   *
   * If `data` is not passed, the input data will be read from `inputs/<circuit>/<input>.json`.
   *
   * @returns path of the created witness
   */
  async witness(circuit: string, input: string, data?: CircuitSignals): Promise<string> {
    const wasmPath = this.path.ofCircuit(circuit, 'wasm');
    const wtnsPath = this.path.ofCircuitWithInput(circuit, input, 'wtns');
    const outDir = this.path.ofCircuitWithInput(circuit, input, 'dir');
    const jsonInput = data ?? JSON.parse(readFileSync(this.path.ofCircuitWithInput(circuit, input, 'in'), 'utf-8'));

    mkdirSync(outDir, {recursive: true});
    await snarkjs.wtns.calculate(jsonInput, wasmPath, wtnsPath);
    return wtnsPath;
  }

  /** Exports a JSON input file for some circuit with the given object.
   *
   * This is useful for testing real circuits, or creating an input programmatically.
   * Overwrites an existing input.
   *
   * @returns path of the created input file
   */
  input(circuit: string, input: string, data: CircuitSignals): string {
    const inputPath = this.path.ofCircuitWithInput(circuit, input, 'in');
    if (existsSync(inputPath)) {
      this.log.warn('Input file exists already, overwriting it.');
    }
    writeFileSync(inputPath, prettyStringify(data));
    return inputPath;
  }

  /** Export a circuit artifact in JSON format.
   *
   * Returns the JSON object itself, and the path that it would be exported to with
   * respect to the Circomkit configuration.
   *
   * @returns a JSON object or the path that it would be exported to.
   */
  async json(type: 'r1cs' | 'zkey', circuit: string): Promise<{json: object; path: string}>;
  async json(type: 'wtns', circuit: string, input: string): Promise<{json: object; path: string}>;
  async json(type: 'r1cs' | 'zkey' | 'wtns', circuit: string, input?: string): Promise<{json: object; path: string}> {
    let json: object;
    let path: string;

    switch (type) {
      // R1CS
      case 'r1cs': {
        path = this.path.ofCircuit(circuit, 'r1cs');
        json = await snarkjs.r1cs.exportJson(path, undefined); // internal log didnt make sense
        break;
      }
      // Prover key
      case 'zkey': {
        // must be groth16, others give error (tested at snarkjs v0.7.0)
        if (this.config.protocol !== 'groth16') {
          throw new Error('Exporting zKey to JSON is only supported for Groth16 at the moment.');
        }

        path = this.path.ofCircuit(circuit, 'pkey');
        json = await snarkjs.zKey.exportJson(path);
        break;
      }
      // Witness
      case 'wtns': {
        if (!input) throw new Error('Expected input');
        path = this.path.ofCircuitWithInput(circuit, input, 'wtns');
        json = await snarkjs.wtns.exportJson(path);
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

  /** Compiles the circuit and returns a witness tester instance. */
  async WitnessTester<IN extends string[] = [], OUT extends string[] = []>(
    circuit: string,
    circuitConfig: CircuitConfig & {recompile?: boolean}
  ) {
    circuitConfig.dir ??= 'test'; // defaults to test directory

    const targetPath = this.instantiate(circuit, circuitConfig);
    const circomWasmTester: CircomWasmTester = await wasm_tester(targetPath, {
      output: undefined, // this makes tests to be created under /tmp
      prime: this.config.prime,
      verbose: this.config.verbose,
      O: Math.min(this.config.optimization, 1), // tester doesnt have O2
      json: false,
      include: this.config.include,
      wasm: true,
      sym: true,
      recompile: circuitConfig.recompile ?? true,
    });

    return new WitnessTester<IN, OUT>(circomWasmTester);
  }

  /** Returns a proof tester. */
  async ProofTester<IN extends string[] = [], P extends CircomkitConfig['protocol'] = 'groth16'>(
    circuit: string,
    protocol: P
  ) {
    const wasmPath = this.path.ofCircuit(circuit, 'wasm');
    const pkeyPath = this.path.ofCircuit(circuit, 'pkey');
    const vkeyPath = this.path.ofCircuit(circuit, 'vkey');

    const missingPaths = [wasmPath, pkeyPath, vkeyPath].filter(p => !existsSync(p));
    if (missingPaths.length !== 0) {
      throw new Error('Missing files: ' + missingPaths.join(', '));
    }

    return new ProofTester<IN, P>(wasmPath, pkeyPath, vkeyPath, protocol);
  }
}
