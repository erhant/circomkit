import {execFile} from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {readFile, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, resolve as resolvePath} from 'node:path';
import {promisify} from 'node:util';
import loglevel from 'loglevel';
import * as snarkjs from 'snarkjs';
import {type CircomkitConfig, DEFAULT, PRIMES, PROTOCOLS} from '../configs';
import {
  compileCircuit,
  formatConstraints,
  getCalldata,
  instantiateCircuit,
  isCompiled,
  type MainComponentConfig,
  readR1CSInfo,
} from '../functions';
import {cWitnessCalculator, cWitnessCalculatorPath, wasmWitnessCalculator} from '../functions/witness';
import {ProofTester, WitnessTester} from '../testers';
import type {CircuitConfig, CircuitSignals} from '../types';
import {prettyStringify} from '../utils';
import {downloadPtau, getPtauName} from '../utils/ptau';
import {singleThreadOnBun} from '../utils/teardown';
import {CircomkitPath} from './pathing';

const execFileAsync = promisify(execFile);

/** Length of the hash in witness tester build directory names. */
const WITNESS_TESTER_HASH_LENGTH = 8;

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

    this.config = structuredClone(config) as CircomkitConfig;
    this.log = loglevel.getLogger('Circomkit');
    this.log.setLevel(this.config.logLevel);

    // logger for SnarkJS, accepted as an optional argument within their functions
    this.snarkjsLogger = this.config.verbose ? this.log : undefined;

    this.sanitize(this.config, (...msg) => this.log.warn(...msg));
    this.path = new CircomkitPath(this.config, circuit => this.resolve(circuit));
  }

  /** Validates a configuration in place, fixing what can be fixed with a log message. */
  private sanitize(config: CircomkitConfig, logFix: (...msg: unknown[]) => void): CircomkitConfig {
    if (!PRIMES.includes(config.prime)) {
      throw new Error('Invalid prime in configuration.');
    }
    if (!PROTOCOLS.includes(config.protocol)) {
      throw new Error('Invalid protocol in configuration.');
    }
    if (config.optimization !== undefined && typeof config.optimization !== 'number') {
      throw new Error('Invalid optimization level.');
    }
    if (typeof config.optimization === 'number' && config.optimization < 0) {
      logFix('Optimization level must be at least 0, setting it to 0.');
      config.optimization = 0;
    }

    // PLONK protocol requires optimization level to be 1
    if (config.protocol === 'plonk' && config.optimization !== 1) {
      logFix(
        'Optimization level for PLONK must be 1.\n',
        'See: https://docs.circom.io/circom-language/circom-insight/simplification/'
      );
      config.optimization = 1;
    }

    return config;
  }

  /** Returns the configuration of a circuit, i.e. the global configuration with the circuit's `overrides` applied.
   *
   * If `circuitConfig` is omitted, the circuit config is looked up from `circuits`; a circuit that is not found
   * there simply uses the global configuration.
   */
  resolve(circuit: string, circuitConfig?: CircuitConfig): CircomkitConfig {
    const overrides = (circuitConfig ?? this.findCircuitConfig(circuit))?.overrides;
    if (!overrides) return this.config;

    // fixes are logged at debug level, as this runs for every path of the circuit
    return this.sanitize({...this.config, ...JSON.parse(JSON.stringify(overrides))}, (...msg) =>
      this.log.debug(...msg)
    );
  }

  /** Returns the circuit configurations, read from `circuits.json` unless they are given inline in the config. */
  readCircuits(): Record<string, CircuitConfig> {
    const {circuits} = this.config;
    if (typeof circuits !== 'string') return structuredClone(circuits); // callers must not edit the config

    const circuitsFile = JSON.parse(readFileSync(circuits, 'utf-8'));
    delete circuitsFile.$schema; // for editors, not a circuit
    return circuitsFile;
  }

  /** Returns a single circuit config from `circuits.json` (or the inline circuits). */
  readCircuitConfig(circuit: string): CircuitConfig {
    const circuitConfig = this.findCircuitConfig(circuit);
    if (!circuitConfig) {
      const where = typeof this.config.circuits === 'string' ? this.config.circuits : 'circuits';
      throw new Error(`No such circuit "${circuit}" in ${where}`);
    }
    return circuitConfig;
  }

  /** Like {@link readCircuitConfig}, but returns `undefined` when there is no such circuit, or no `circuits.json`. */
  private findCircuitConfig(circuit: string): CircuitConfig | undefined {
    if (typeof this.config.circuits === 'string' && !existsSync(this.config.circuits)) return undefined;
    const circuits = this.readCircuits();
    return circuit in circuits ? circuits[circuit] : undefined;
  }

  /** Clear build files, witness tester builds and the `main` component of a circuit. */
  async clear(circuit: string): Promise<void> {
    const config = this.resolve(circuit);
    // the main component is under the circuit's `dir`, see `instantiate`
    const dir = this.findCircuitConfig(circuit)?.dir || 'main';

    // witness tester builds are named `<circuit>-<hash>`, see `WitnessTester`
    const testerDir = `${config.dirBuild}/.witness-tester`;
    const testerBuilds = existsSync(testerDir)
      ? readdirSync(testerDir).filter(
          name => name.startsWith(`${circuit}-`) && name.length === circuit.length + 1 + WITNESS_TESTER_HASH_LENGTH
        )
      : [];

    await Promise.all([
      rm(this.path.ofCircuit(circuit, 'dir'), {recursive: true, force: true}),
      rm(`${config.dirCircuits}/${dir}/${circuit}.circom`, {force: true}),
      ...testerBuilds.map(name => rm(`${testerDir}/${name}`, {recursive: true, force: true})),
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
    await singleThreadOnBun();
    const vkey = await snarkjs.zKey.exportVerificationKey(pkeyPath, this.snarkjsLogger);
    writeFileSync(vkeyPath, prettyStringify(vkey));

    return vkeyPath;
  }

  /** Returns circuit information. */
  async info(circuit: string) {
    return await readR1CSInfo(this.path.ofCircuit(circuit, 'r1cs'));
  }

  /** Returns the constraints of a compiled circuit as human-readable formulas, e.g. `in[0] * in[1] = inner[0]`.
   *
   * With a `filter`, only the constraints using that signal or component are returned, e.g. `isZero[0]`.
   * They are streamed with {@link Circomkit.streamConstraints}.
   */
  async constraints(circuit: string, filter?: string): Promise<string[]> {
    const lines: string[] = [];
    for await (const line of this.streamConstraints(circuit, filter)) lines.push(line);
    return lines;
  }

  /** Same as {@link Circomkit.constraints}, but yields the formulas one by one, for large circuits. */
  streamConstraints(circuit: string, filter?: string): AsyncGenerator<string> {
    return formatConstraints(this.path.ofCircuit(circuit, 'r1cs'), this.path.ofCircuit(circuit, 'sym'), filter);
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
    // checked first, as the PTAU files are for bn128 only, even if one exists locally
    const config = this.resolve(circuit);
    if (config.prime !== 'bn128') {
      throw new Error('Auto-downloading PTAU only allowed for bn128 at the moment.');
    }

    // Groth16 needs 2^p > constraints + public signals, see `newZKey` of SnarkJS
    // TODO: PLONK & FFLONK need more (additions count too), `setup` throws if this is too small
    const {constraints, publicInputs, publicOutputs} = await this.info(circuit);
    const ptauName = getPtauName(constraints + publicInputs + publicOutputs + 1);
    const ptauPath = `${config.dirPtau}/${ptauName}`;
    if (existsSync(ptauPath)) {
      return ptauPath;
    }

    mkdirSync(config.dirPtau, {recursive: true});
    this.log.info(`Downloading ${ptauName}, this may take a while.`);
    return await downloadPtau(ptauName, config.dirPtau);
  }

  /** Compile the circuit.
   *
   * A circuit configuration can be passed optionally; if not, the
   * config will be read from `circuits.json` at the working directory.
   *
   * @returns path of the build directory
   */
  async compile(circuit: string, circuitConfig?: CircuitConfig) {
    const config = this.resolve(circuit, circuitConfig);
    const targetPath = this.instantiate(circuit, circuitConfig);
    this.log.debug(`Main component created at: ${targetPath}`);

    const outDir = new CircomkitPath(config).ofCircuit(circuit, 'dir');

    const {stdout, stderr} = await compileCircuit(config, targetPath, outDir);
    if (config.verbose) {
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
    const {protocol} = this.resolve(circuit);
    const pkey = this.path.ofCircuit(circuit, 'pkey');
    await singleThreadOnBun();
    // resolve snarkjs like the user's project would (also when hoisted), its main entry is `<root>/build/main.cjs`
    const snarkjsRoot = dirname(dirname(createRequire(`${process.cwd()}/`).resolve('snarkjs')));
    const template = readFileSync(`${snarkjsRoot}/templates/verifier_${protocol}.sol.ejs`, 'utf-8');
    const contractCode = await snarkjs.zKey.exportSolidityVerifier(pkey, {[protocol]: template}, this.snarkjsLogger);

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

    const res = getCalldata(proof, pubs, pretty ?? this.resolve(circuit).prettyCalldata);
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
    const {dirCircuits, version} = this.resolve(circuit, circuitConfig);
    if (!circuitConfig) {
      const circuitConfigFile = this.readCircuitConfig(circuit);
      circuitConfig = {
        ...circuitConfigFile,
        dir: circuitConfigFile.dir || 'main',
      };
    }

    const circomSource = readFileSync(`${dirCircuits}/${circuitConfig.file}.circom`, 'utf8');

    // TODO: do we need regex here?
    const usesCustomTemplates =
      circuitConfig.usesCustomTemplates ??
      circomSource
        .replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '') // remove single and multi-line comments
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

    const config: MainComponentConfig = {
      file: file,
      template: circuitConfig.template,
      // Precedence: circuit `version` > `overrides.version` > global `version` > "2.0.0".
      version: circuitConfig.version || version || '2.0.0',
      dir: directory,
      pubs: circuitConfig.pubs || [],
      params: circuitConfig.params || [],
      usesCustomTemplates,
    };

    const targetDir = `${dirCircuits}/${directory}`;
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

    await singleThreadOnBun();
    const {proof, publicSignals} = await snarkjs[this.resolve(circuit).protocol].fullProve(
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
      ptauPath = await this.ptau(circuit);
    } else if (!existsSync(ptauPath)) {
      // if the provided path does not exist, we can download it anyways
      this.log.warn('PTAU path was given but no PTAU exists there, downloading it anyways.');
      ptauPath = await this.ptau(circuit);
    }

    // circuit specific setup
    this.log.info('Beginning setup phase!');
    await singleThreadOnBun();
    const config = this.resolve(circuit);
    // SnarkJS returns -1 on failure (e.g. PTAU too small) and only says why to its logger
    const setupError = new Error(`Setup failed for ${circuit}, the PTAU may be too small: ${ptauPath}`);
    if (config.protocol === 'groth16') {
      // Groth16 needs a circuit specific setup

      // generate genesis zKey
      let curZkey = this.path.ofZkey(circuit, 0);
      if ((await snarkjs.zKey.newZKey(r1csPath, ptauPath, curZkey, this.snarkjsLogger)) === -1) {
        throw setupError;
      }

      // make contributions
      for (let contrib = 1; contrib <= config.groth16numContributions; contrib++) {
        const nextZkey = this.path.ofZkey(circuit, contrib);

        // entropy, if user wants to prompt give undefined
        this.log.info(`Making contribution: ${contrib}`);
        await snarkjs.zKey.contribute(
          curZkey,
          nextZkey,
          `${circuit}_${contrib}`,
          config.groth16askForEntropy ? undefined : randomBytes(32), // entropy
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
      if (
        ((await snarkjs[config.protocol].setup(r1csPath, ptauPath, pkeyPath, this.snarkjsLogger)) as unknown) === -1
      ) {
        throw setupError;
      }
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

    await singleThreadOnBun();
    return await snarkjs[this.resolve(circuit).protocol].verify(vkey, pubs, proof, this.snarkjsLogger);
  }

  /** Calculates the witness for the given circuit and input.
   *
   * If `data` is not passed, the input data will be read from `inputs/<circuit>/<input>.json`.
   *
   * With `calculator: 'c'` the C witness calculator is used, which is compiled and built with `make` if
   * missing; that requires the C witness dependencies (see Circom docs).
   *
   * @returns path of the created witness
   */
  async witness(
    circuit: string,
    input: string,
    data?: CircuitSignals,
    calculator: 'wasm' | 'c' = 'wasm'
  ): Promise<string> {
    const wtnsPath = this.path.ofCircuitWithInput(circuit, input, 'wtns');
    const outDir = this.path.ofCircuitWithInput(circuit, input, 'dir');
    const inputPath = this.path.ofCircuitWithInput(circuit, input, 'in');
    mkdirSync(outDir, {recursive: true});

    if (calculator === 'wasm') {
      const wasmPath = this.path.ofCircuit(circuit, 'wasm');
      if (!existsSync(wasmPath)) {
        this.log.warn('WASM file does not exist, creating it now...');
        await this.compile(circuit);
      }
      const jsonInput = data ?? JSON.parse(readFileSync(inputPath, 'utf-8'));
      await snarkjs.wtns.calculate(jsonInput, wasmPath, wtnsPath);
      return wtnsPath;
    }

    const cppDir = `${this.path.ofCircuit(circuit, 'dir')}/${circuit}_cpp`;
    const binPath = `${cppDir}/${circuit}`;
    if (!existsSync(binPath)) {
      if (!existsSync(cppDir)) {
        this.log.warn('C witness calculator does not exist, creating it now...');
        const circuitConfig = this.readCircuitConfig(circuit);
        await this.compile(circuit, {
          ...circuitConfig,
          dir: circuitConfig.dir || 'main', // as for configs read by `compile` itself
          overrides: {...circuitConfig.overrides, cWitness: true},
        });
      }
      await execFileAsync('make', ['-C', cppDir]);
    }

    // the C calculator only reads inputs from a file
    const jsonPath = data ? `${outDir}/input.json` : inputPath;
    if (data) writeFileSync(jsonPath, prettyStringify(data));
    try {
      await execFileAsync(binPath, [jsonPath, wtnsPath]);
    } finally {
      if (data) rmSync(jsonPath);
    }
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
  async json(target: 'r1cs' | 'zkey', circuit: string): Promise<{json: object; path: string}>;
  async json(target: 'wtns', circuit: string, input: string): Promise<{json: object; path: string}>;
  async json(target: 'r1cs' | 'zkey' | 'wtns', circuit: string, input?: string): Promise<{json: object; path: string}> {
    let json: object;
    let path: string;

    switch (target) {
      // R1CS
      case 'r1cs': {
        path = this.path.ofCircuit(circuit, 'r1cs');
        json = await snarkjs.r1cs.exportJson(path, undefined); // internal log didnt make sense
        break;
      }
      // Prover key
      case 'zkey': {
        // must be groth16, others give error (tested at snarkjs v0.7.0)
        if (this.resolve(circuit).protocol !== 'groth16') {
          throw new Error('Exporting zKey to JSON is only supported for Groth16 at the moment.');
        }

        path = this.path.ofCircuit(circuit, 'pkey');
        await singleThreadOnBun();
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
        target satisfies never;
        throw new Error(`Unknown export target: ${target}`);
    }

    return {
      json,
      path: `${path}.json`,
    };
  }

  /** Compiles the circuit and returns a witness tester instance.
   *
   * The circuit is compiled under `<dirBuild>/.witness-tester`, in a directory named after the circuit and
   * a hash of its `main` component & compiler options, so that testers with different parameters never share a build.
   *
   * By default, compilation is skipped if that build is newer than the circuit and all of its includes.
   * Set `recompile` to `true` to always compile, or to `false` to never compile.
   *
   * The global `optimization` is capped at O1 here, so that signals stay readable in tests. Set it in the
   * circuit's `overrides` to test with another level, e.g. `{...config, overrides: {optimization: 2}}`.
   */
  async WitnessTester<IN extends string[] = [], OUT extends string[] = []>(
    circuit: string,
    circuitConfig: CircuitConfig & {recompile?: boolean},
    tester: 'wasm' | 'c' = 'wasm'
  ) {
    circuitConfig = {...circuitConfig, dir: circuitConfig.dir ?? 'test'}; // defaults to test directory

    const resolved = this.resolve(circuit, circuitConfig);
    const config: CircomkitConfig = {
      ...resolved,
      // the global optimization is capped at O1 as it always was, an explicit per-circuit override is not
      optimization:
        circuitConfig.overrides?.optimization === undefined && typeof resolved.optimization === 'number'
          ? Math.min(resolved.optimization, 1)
          : resolved.optimization,
      wasmWitness: tester === 'wasm',
      cWitness: tester === 'c',
    };
    const targetPath = this.instantiate(circuit, circuitConfig);

    const hash = createHash('sha256')
      .update(
        JSON.stringify([
          tester,
          config.prime,
          config.optimization,
          config.include,
          resolvePath(targetPath), // the template is included relative to it
          readFileSync(targetPath, 'utf-8'),
        ])
      )
      .digest('hex')
      .slice(0, WITNESS_TESTER_HASH_LENGTH);
    const output = `${config.dirBuild}/.witness-tester/${circuit}-${hash}`;
    const artifact =
      tester === 'wasm' ? `${output}/${circuit}_js/${circuit}.wasm` : cWitnessCalculatorPath(output, circuit);

    const recompile = circuitConfig.recompile ?? !isCompiled(artifact, targetPath, config.include);
    if (recompile) {
      // concurrent testers of the same circuit (e.g. test files run in parallel) must not write to the same files,
      // so each compiles into its own directory, which is moved in place unless another tester did so meanwhile
      const builtAt = () => (existsSync(artifact) ? statSync(artifact).mtimeMs : undefined);
      const previousBuild = builtAt();
      const tmpOutput = `${output}.tmp-${randomBytes(4).toString('hex')}`;
      try {
        const {stderr} = await compileCircuit(config, targetPath, tmpOutput);
        if (stderr) this.log.error(stderr);
        if (tester === 'c') await execFileAsync('make', ['-C', `${tmpOutput}/${circuit}_cpp`]);

        if (builtAt() === previousBuild) {
          rmSync(output, {recursive: true, force: true});
          try {
            renameSync(tmpOutput, output);
          } catch (err) {
            // another tester may have moved its build in place between the removal & the rename
            if (!existsSync(artifact)) throw err;
          }
        }
      } finally {
        rmSync(tmpOutput, {recursive: true, force: true});
      }
    } else if (!existsSync(artifact)) {
      throw new Error(`Cannot set recompile to false if ${artifact} does not exist`);
    }

    const calculator =
      tester === 'wasm' ? await wasmWitnessCalculator(output, circuit) : cWitnessCalculator(output, circuit);
    return new WitnessTester<IN, OUT>(output, circuit, calculator);
  }

  /** Returns a proof tester, for a circuit that is compiled & set up.
   *
   * The `protocol` is the circuit's protocol in the config by default.
   */
  async ProofTester<IN extends string[] = [], P extends CircomkitConfig['protocol'] = 'groth16'>(
    circuit: string,
    protocol: P = this.resolve(circuit).protocol as P
  ) {
    const wasmPath = this.path.ofCircuit(circuit, 'wasm');
    const pkeyPath = this.path.ofCircuit(circuit, 'pkey');
    const vkeyPath = this.path.ofCircuit(circuit, 'vkey');

    const missingPaths = [wasmPath, pkeyPath, vkeyPath].filter(p => !existsSync(p));
    if (missingPaths.length !== 0) {
      throw new Error(`Missing files: ${missingPaths.join(', ')}`);
    }

    await singleThreadOnBun();
    return new ProofTester<IN, P>(wasmPath, pkeyPath, vkeyPath, protocol);
  }
}
