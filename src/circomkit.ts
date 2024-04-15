import * as snarkjs from 'snarkjs';
const wasm_tester = require('circom_tester').wasm;
import {writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, renameSync} from 'fs';
import {readFile, rm, writeFile} from 'fs/promises';
import {randomBytes} from 'crypto';
import {Logger, getLogger} from 'loglevel';
import {exec} from 'child_process';
import {makeCircuit} from './utils/';
import {downloadPtau, getPtauName} from './utils/ptau';
import type {
  CircuitConfig,
  CircuitSignals,
  R1CSInfoType,
  CircomkitConfig,
  CircomkitConfigOverrides,
  CircuitInputPathBuilders,
  CircuitPathBuilders,
  CircomWasmTester,
} from './types/';
import {WitnessTester, ProofTester} from './testers/';
import {prettyStringify, primeToName} from './utils';
import {defaultConfig, colors, PRIMES, PROTOCOLS} from './utils/config';
import {getCalldata} from './utils/calldata';

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
  public readonly logger: Logger;
  private readonly snarkjsLogger: Logger | undefined;

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

    // logger for SnarkJS, accepted as an optional argument within their functions
    this.snarkjsLogger = this.config.verbose ? this.logger : undefined;

    // sanity checks
    if (!PRIMES.includes(this.config.prime)) {
      throw new Error('Invalid prime in configuration.');
    }
    if (!PROTOCOLS.includes(this.config.protocol)) {
      throw new Error('Invalid protocol in configuration.');
    }
    if (this.config.optimization < 0) {
      this.log('Optimization level must be at least 0, setting it to 0.', 'warn');
      this.config.optimization = 0;
    }

    // PLONK protocol requires optimization level to be 1
    if (this.config.protocol === 'plonk' && this.config.optimization !== 1) {
      this.log(
        'Optimization level for PLONK must be 1.\nSee: https://docs.circom.io/circom-language/circom-insight/simplification/',
        'warn'
      );
      this.config.optimization = 1;
    }
  }

  /** Parse circuit config from `circuits.json`. */
  private readCircuitConfig(circuit: string): CircuitConfig {
    const circuits = JSON.parse(readFileSync(this.config.circuits, 'utf-8'));
    if (!(circuit in circuits)) {
      throw new Error('No such circuit in ' + this.config.circuits);
    }
    return circuits[circuit] as CircuitConfig;
  }

  /** Computes a path that requires a circuit name. */
  private path(circuit: string, type: CircuitPathBuilders): string {
    const dir = `${this.config.dirBuild}/${circuit}`;
    switch (type) {
      case 'dir':
        return dir;
      case 'main':
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

  /** Computes a path that requires a circuit and an input name. */
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

  /** Given a circuit & id name, returns the relative path of the phase-2 PTAU.
   * This is used in particular by Groth16's circuit-specific setup phase. */
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

  /** Clean build files and the `main` component of a circuit. */
  async clean(circuit: string): Promise<void> {
    await Promise.all([
      rm(this.path(circuit, 'dir'), {recursive: true, force: true}),
      rm(this.path(circuit, 'main'), {force: true}),
    ]);
  }

  /** Export a verification key (vKey) from a proving key (zKey). */
  async vkey(circuit: string, pkeyPath?: string): Promise<string> {
    const vkeyPath = this.path(circuit, 'vkey');

    // check if it exists
    if (pkeyPath === undefined) {
      pkeyPath = this.path(circuit, 'pkey');
    }

    if (!existsSync(pkeyPath)) {
      throw new Error('There must be a prover key for this circuit to extract a verification key.');
    }

    // extract it
    const vkey = await snarkjs.zKey.exportVerificationKey(pkeyPath, this.snarkjsLogger);
    writeFileSync(vkeyPath, prettyStringify(vkey));

    return vkeyPath;
  }

  /** Information about circuit. */
  async info(circuit: string): Promise<R1CSInfoType> {
    // we do not pass `this.snarkjsLogger` here on purpose
    const r1csinfo = await snarkjs.r1cs.info(this.path(circuit, 'r1cs'), undefined);

    return {
      variables: r1csinfo.nVars,
      constraints: r1csinfo.nConstraints,
      privateInputs: r1csinfo.nPrvInputs,
      publicInputs: r1csinfo.nPubInputs,
      useCustomGates: r1csinfo.useCustomGates,
      labels: r1csinfo.nLabels,
      outputs: r1csinfo.nOutputs,
      prime: r1csinfo.prime,
      primeName: primeToName[r1csinfo.prime.toString(10) as `${bigint}`],
    };
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
    if (this.config.prime !== 'bn128') {
      throw new Error('Auto-downloading PTAU only allowed for bn128 at the moment.');
    }

    // @todo check for performance gains when larger PTAUs are found instead of the target PTAU
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
   *
   * A circuit configuration can be passed optionally; if not, the
   * config will be read from `circuits.json` at the working directory.
   *
   * @returns path of the build directory
   */
  async compile(circuit: string, config?: CircuitConfig) {
    const targetPath = this.instantiate(circuit, config);
    this.log('Main component created at: ' + targetPath, 'debug');

    const outDir = this.path(circuit, 'dir');
    mkdirSync(outDir, {recursive: true});

    // prettier-ignore
    let flags = `--sym --wasm --r1cs -p ${this.config.prime} -o ${outDir}`;
    if (this.config.include.length > 0) flags += ' ' + this.config.include.map(path => `-l ${path}`).join(' ');
    if (this.config.verbose) flags += ' --verbose';
    if (this.config.inspect) flags += ' --inspect';
    if (this.config.cWitness) flags += ' --c';
    if (this.config.optimization > 2) {
      // --O2round <value>
      flags += ` --O2round ${this.config.optimization}`;
    } else {
      // --O0, --O1 or --O2
      flags += ` --O${this.config.optimization}`;
    }

    // call `circom` as a sub-process
    try {
      const result = await new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
        exec(`circom ${flags} ${targetPath}`, (error, stdout, stderr) => {
          if (error === null) {
            resolve({stdout, stderr});
          } else {
            reject(error);
          }
        });
      });
      if (this.config.verbose) {
        this.log(result.stdout);
      }
      if (result.stderr) {
        this.log(result.stderr, 'error');
      }
    } catch (e) {
      throw new Error('Compiler error:\n' + e);
    }

    return outDir;
  }

  /** Exports a solidity contract for the verifier.
   * @returns path of the exported Solidity contract
   */
  async contract(circuit: string) {
    const pkey = this.path(circuit, 'pkey');
    const template = readFileSync(`./node_modules/snarkjs/templates/verifier_${this.config.protocol}.sol.ejs`, 'utf-8');
    const contractCode = await snarkjs.zKey.exportSolidityVerifier(
      pkey,
      {[this.config.protocol]: template},
      this.snarkjsLogger
    );

    const contractPath = this.path(circuit, 'sol');
    writeFileSync(contractPath, contractCode);
    return contractPath;
  }

  /** Export calldata to call a Verifier contract.
   * @returns calldata
   */
  async calldata(circuit: string, input: string): Promise<string> {
    const pubs: snarkjs.PublicSignals = JSON.parse(await readFile(this.pathWithInput(circuit, input, 'pubs'), 'utf-8'));
    const proof: snarkjs.Groth16Proof & snarkjs.PlonkProof & snarkjs.FflonkProof = JSON.parse(
      await readFile(this.pathWithInput(circuit, input, 'proof'), 'utf-8')
    );

    // const res = await snarkjs[this.config.protocol].exportSolidityCallData(proof as any, pubs as any);
    const res = getCalldata(proof, pubs, this.config.prettyCalldata);
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

    // directory to output the file
    const directory = circuitConfig.dir || 'test';

    // add "../" to the filename in include, one for each "/" in directory name
    // if none, the prefix becomes empty string
    const filePrefixMatches = directory.match(/\//g);
    let file = circuitConfig.file;
    if (filePrefixMatches !== null) {
      file = '../'.repeat(filePrefixMatches.length) + file;
    }

    // generate the code for `main` component
    const circuitCode = makeCircuit({
      file: file,
      template: circuitConfig.template,
      version: circuitConfig.version || '2.0.0',
      dir: directory,
      pubs: circuitConfig.pubs || [],
      params: circuitConfig.params || [],
    });

    // check the target directory
    const targetDir = `${this.config.dirCircuits}/${directory}`;
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, {
        recursive: true,
      });
    }

    // write main component to file
    const targetPath = `${targetDir}/${circuit}.circom`;
    writeFileSync(targetPath, circuitCode);

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

    const jsonInput = data || JSON.parse(readFileSync(this.pathWithInput(circuit, input, 'in'), 'utf-8'));

    const {proof, publicSignals} = await snarkjs[this.config.protocol].fullProve(
      jsonInput,
      wasmPath,
      pkeyPath,
      this.snarkjsLogger
    );

    const dir = this.pathWithInput(circuit, input, 'dir');
    mkdirSync(dir, {recursive: true});
    await Promise.all([
      writeFile(this.pathWithInput(circuit, input, 'pubs'), prettyStringify(publicSignals)),
      writeFile(this.pathWithInput(circuit, input, 'proof'), prettyStringify(proof)),
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
    const r1csPath = this.path(circuit, 'r1cs');
    const pkeyPath = this.path(circuit, 'pkey');
    const vkeyPath = this.path(circuit, 'vkey');

    // create R1CS if needed
    if (!existsSync(r1csPath)) {
      this.log('R1CS does not exist, creating it now...', 'warn');
      await this.compile(circuit);
    }

    // get ptau path
    this.log('Checking for PTAU file...', 'debug');

    if (ptauPath === undefined) {
      // if no ptau is given, we can download it
      if (this.config.prime !== 'bn128') {
        throw new Error('Please provide PTAU file when using a prime field other than bn128');
      }
      ptauPath = await this.ptau(circuit);
    } else if (!existsSync(ptauPath)) {
      // if the provided path does not exist, we can download it anyways
      this.log('PTAU path was given but no PTAU exists there, downloading it anyways.', 'warn');
      ptauPath = await this.ptau(circuit);
    }

    // circuit specific setup
    this.log('Beginning setup phase!', 'info');
    if (this.config.protocol === 'groth16') {
      // Groth16 needs a circuit specific setup

      // generate genesis zKey
      let curZkey = this.pathZkey(circuit, 0);
      await snarkjs.zKey.newZKey(r1csPath, ptauPath, curZkey, this.snarkjsLogger);

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
          this.path(circuit, 'vkey'),
          this.pathWithInput(circuit, input, 'pubs'),
          this.pathWithInput(circuit, input, 'proof'),
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
    const wasmPath = this.path(circuit, 'wasm');
    const wtnsPath = this.pathWithInput(circuit, input, 'wtns');
    const outDir = this.pathWithInput(circuit, input, 'dir');
    const jsonInput = data || JSON.parse(readFileSync(this.pathWithInput(circuit, input, 'in'), 'utf-8'));

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
    const inputPath = this.pathWithInput(circuit, input, 'in');
    if (existsSync(inputPath)) {
      this.log('Input file exists already, overwriting it.', 'warn');
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
          throw new Error('Exporting zKey to JSON is only supported for Groth16 at the moment.');
        }

        path = this.path(circuit, 'pkey');
        json = await snarkjs.zKey.exportJson(path);
        break;
      }
      // Witness
      case 'wtns': {
        if (!input) throw new Error('Expected input');
        path = this.pathWithInput(circuit, input, 'wtns');
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
  async ProofTester<IN extends string[] = []>(circuit: string) {
    const wasmPath = this.path(circuit, 'wasm');
    const pkeyPath = this.path(circuit, 'pkey');
    const vkeyPath = this.path(circuit, 'vkey');

    // check if all files are present
    const missingPaths = [wasmPath, pkeyPath, vkeyPath].filter(p => !existsSync(p));
    if (missingPaths.length !== 0) {
      throw new Error('Missing files: ' + missingPaths.join(', '));
    }

    return new ProofTester<IN>(wasmPath, pkeyPath, vkeyPath);
  }
}
