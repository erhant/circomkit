import {mkdirSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync} from 'node:fs';
import {Circomkit, type WitnessTester} from '../src';
import {prepareMultiplier} from './common';

describe('witness tester', () => {
  let circomkit: Circomkit;
  let circuit: WitnessTester<['in'], ['out']>;
  const {
    circuit: {name, config, size, exact},
    signals,
  } = prepareMultiplier(4);

  beforeAll(async () => {
    circomkit = new Circomkit({
      verbose: false,
      logLevel: 'silent',
      circuits: './tests/circuits.json',
      dirPtau: './tests/ptau',
      dirCircuits: './tests/circuits',
      dirInputs: './tests/inputs',
      dirBuild: './tests/build',
      optimization: 2,
    });
    circuit = await circomkit.WitnessTester(name, {...config, recompile: true});
  });

  it('should have correct number of constraints', async () => {
    await circuit.expectConstraintCount(size!, exact);

    // should also work for non-exact too, where we expect at least some amount
    await circuit.expectConstraintCount(size!);
    await circuit.expectConstraintCount(size! - 1);
  });

  it('should assert correctly', async () => {
    await circuit.expectPass(signals.input, signals.output);
  });

  it('should fail for bad witness', async () => {
    await circuit.expectFail(signals.badInput);
  });

  it('should compute witnesses in parallel', async () => {
    const inputs = Array.from({length: 10}, (_, i) => [i + 2, i + 3, i + 5, i + 7]);
    await Promise.all(inputs.map(input => circuit.expectPass({in: input}, {out: input.reduce((a, b) => a * b)})));
  });

  it('should compute correctly', async () => {
    const output = await circuit.compute(signals.input, ['out']);
    expect(output).toHaveProperty('out');
    expect(output.out).toEqual(BigInt(signals.output.out));
  });

  it('should compute correctly with multiple output signals', async () => {
    const N = 167;
    const newSize = N + N - 1;
    const a = 2;
    const b = 3;
    const aOut = Array(newSize)
      .fill(0)
      .map((_, i) => BigInt(i < N ? a * i : 0));
    const bOut = Array(newSize)
      .fill(0)
      .map((_, i) => BigInt(i < N ? b * i : 0));
    const cOut = Array(N).fill(BigInt(a * b));

    const circuit2 = await circomkit.WitnessTester('multiout', {
      file: 'multiout',
      template: 'Multiout',
      params: [N],
    });

    const input = {
      a: Array(N).fill(a),
      b: Array(N).fill(b),
    };
    const output = await circuit2.compute(input, ['aOut', 'bOut', 'cOut']);

    expect(output).toHaveProperty('aOut');
    expect(output).toHaveProperty('bOut');
    expect(output).toHaveProperty('cOut');
    expect(output.aOut).toHaveLength(newSize);
    expect(output.bOut).toHaveLength(newSize);
    expect(output.cOut).toHaveLength(N);
    expect(output.aOut).toEqual(aOut);
    expect(output.bOut).toEqual(bOut);
    expect(output.cOut).toEqual(cOut);

    await circuit2.expectPass(input, output);
  });

  it('should read witness correctly', async () => {
    const witness = await circuit.calculateWitness(signals.input);
    const symbol = 'main.out';
    const symbolValues = await circuit.readWitness(witness, [symbol]);
    expect(symbol in symbolValues).toBe(true);
    expect(symbolValues[symbol]).toEqual(BigInt(signals.output.out));
  });

  it('should assert for correct witness', async () => {
    const witness = await circuit.calculateWitness(signals.input);
    await circuit.expectConstraintPass(witness);
  });

  it('should NOT assert for maliciously edited witness', async () => {
    // create a valid witness
    const witness = await circuit.calculateWitness(signals.input);
    // change the values so that it still computes correctly but is not sound
    const badWitness = await circuit.editWitness(witness, {
      'main.in[0]': 1n,
      'main.in[1]': 1n,
      'main.in[2]': BigInt(signals.output.out),
    });
    await circuit.expectConstraintFail(badWitness);
  });
});

describe('witness tester recompilation', () => {
  const dirBuild = './tests/build/recompile';
  const dirCircuits = `${dirBuild}/circuits`;
  const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits, dirBuild});
  const config = {file: 'top', template: 'Top'};

  /** Modification time of the tester's WASM, there must be exactly one build. */
  const builtAt = () => {
    const builds = readdirSync(`${dirBuild}/.witness-tester`);
    expect(builds).toHaveLength(1);
    return statSync(`${dirBuild}/.witness-tester/${builds[0]}/top_js/top.wasm`).mtimeMs;
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));

  beforeAll(() => {
    // `top` includes `lib`, which is not referenced by the main component directly
    mkdirSync(dirCircuits, {recursive: true});
    writeFileSync(
      `${dirCircuits}/lib.circom`,
      'pragma circom 2.0.0;\ntemplate Square() { signal input in; signal output out; out <== in * in; }\n'
    );
    writeFileSync(
      `${dirCircuits}/top.circom`,
      'pragma circom 2.0.0;\ninclude "lib.circom";\n' +
        'template Top() { signal input in; signal output out; out <== Square()(in); }\n'
    );
  });

  it('should not recompile an unchanged circuit', async () => {
    const circuit = await circomkit.WitnessTester('top', {...config});
    await circuit.expectPass({in: 3}, {out: 9});
    const firstBuild = builtAt();

    await tick();
    await circomkit.WitnessTester('top', {...config});
    expect(builtAt()).toBe(firstBuild);
  });

  it('should recompile when an included file changes', async () => {
    const before = builtAt();
    await tick();
    const now = new Date();
    utimesSync(`${dirCircuits}/lib.circom`, now, now);

    await circomkit.WitnessTester('top', {...config});
    expect(builtAt()).toBeGreaterThan(before);
  });

  it('should clear witness tester builds of the circuit only', async () => {
    mkdirSync(`${dirBuild}/.witness-tester/top-other-12345678`); // a circuit named `top-other`
    await circomkit.clear('top');
    expect(readdirSync(`${dirBuild}/.witness-tester`)).toEqual(['top-other-12345678']);

    // compiles again after clearing
    const circuit = await circomkit.WitnessTester('top', {...config});
    await circuit.expectPass({in: 3}, {out: 9});
    rmSync(`${dirBuild}/.witness-tester/top-other-12345678`, {recursive: true});
  });

  it('should always recompile with recompile: true', async () => {
    const before = builtAt();
    await tick();
    await circomkit.WitnessTester('top', {...config, recompile: true});
    expect(builtAt()).toBeGreaterThan(before);
  });
});

describe('witness tester optimized symbols', () => {
  const dirBuild = './tests/build/optimized';
  const dirCircuits = `${dirBuild}/circuits`;
  const config = {file: 'linear', template: 'Linear'};

  beforeAll(() => {
    // `mid` only equals `a`, which O1 substitutes away
    mkdirSync(dirCircuits, {recursive: true});
    writeFileSync(
      `${dirCircuits}/linear.circom`,
      'pragma circom 2.0.0;\n' +
        'template Linear() { signal input a; signal input b; signal mid; signal output out; mid <== a; out <== mid * b; }\n'
    );
  });

  it('should throw a clear error for optimized symbols', async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits, dirBuild, optimization: 1});
    const circuit = await circomkit.WitnessTester('linear', {...config});
    const witness = await circuit.calculateWitness({a: 2, b: 3});
    const error = 'Symbol main.mid was optimized away by the compiler, use a lower optimization level to keep it';
    await expect(circuit.readWitness(witness, ['main.mid'])).rejects.toThrow(error);
    await expect(circuit.readWitnessSignals(witness, ['mid'])).rejects.toThrow(error);
    await expect(circuit.editWitness(witness, {'main.mid': 1n})).rejects.toThrow(error);
  });

  it('should read the symbol without optimizations', async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits, dirBuild, optimization: 0});
    const circuit = await circomkit.WitnessTester('linear', {...config});
    const witness = await circuit.calculateWitness({a: 2, b: 3});
    expect(await circuit.readWitness(witness, ['main.mid'])).toEqual({'main.mid': 2n});
    expect(await circuit.readWitnessSignals(witness, ['mid'])).toEqual({mid: 2n});
  });

  afterAll(() => rmSync(dirBuild, {recursive: true, force: true}));
});

describe('witness tester anonymous components', () => {
  const dirBuild = './tests/build/anonymous';
  const dirCircuits = `${dirBuild}/circuits`;

  beforeAll(() => {
    mkdirSync(dirCircuits, {recursive: true});
    writeFileSync(
      `${dirCircuits}/anon.circom`,
      'pragma circom 2.0.0;\n' +
        'template Square() { signal input in; signal output out; out <== in * in; }\n' +
        'template Anon() { signal input in; signal output out; out <== Square()(in); }\n'
    );
  });

  it('should read and edit signals of anonymous components', async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits, dirBuild, optimization: 0});
    const circuit = await circomkit.WitnessTester('anon', {file: 'anon', template: 'Anon'});
    const witness = await circuit.calculateWitness({in: 3});

    // named `<template>_<line>_<offset>`, i.e. line 3 and the byte offset of `Square()(in)` in the file
    const symbol = 'main.Square_3_158.out';
    expect(await circuit.readWitness(witness, [symbol])).toEqual({[symbol]: 9n});
    expect(await circuit.readWitnessSignals(witness, ['Square_3_158.out'])).toEqual({'Square_3_158.out': 9n});

    const fakeWitness = await circuit.editWitness(witness, {[symbol]: 10n, 'main.out': 10n});
    await circuit.expectConstraintFail(fakeWitness);
  });

  afterAll(() => rmSync(dirBuild, {recursive: true, force: true}));
});

// the C witness calculator needs nlohmann-json and gmp (and nasm on x86-64), which CI installs on Linux
(process.platform === 'linux' ? describe : describe.skip)('witness tester with the C calculator', () => {
  const circomkit = new Circomkit({
    verbose: false,
    logLevel: 'silent',
    circuits: './tests/circuits.json',
    dirCircuits: './tests/circuits',
    dirBuild: './tests/build',
  });
  const {
    circuit: {name, config},
    signals,
  } = prepareMultiplier(4);

  it('should compute and check the witness', async () => {
    const circuit = await circomkit.WitnessTester<['in'], ['out']>(name, {...config}, 'c');
    await circuit.expectPass(signals.input, signals.output);
    expect(await circuit.compute(signals.input, ['out'])).toEqual({out: BigInt(signals.output.out)});
    await circuit.expectFail(signals.badInput);

    // in parallel too, each call has its own input & witness files
    const inputs = Array.from({length: 5}, (_, i) => [i + 2, i + 3, i + 5, i + 7]);
    await Promise.all(inputs.map(input => circuit.expectPass({in: input}, {out: input.reduce((a, b) => a * b)})));
  });

  it('should catch run-time errors', async () => {
    const errors = await circomkit.WitnessTester('error_rt', {file: 'errors', template: 'Errors'}, 'c');
    await errors.expectFail({in: 1, inin: [1, 2]}); // false assert
    await errors.expectFail({in: 0, inin: [1]}); // not enough values

    const modulo = await circomkit.WitnessTester('error_mod', {file: 'errors', template: 'ModuloByZero'}, 'c');
    await modulo.expectFail({in: 0}); // SIGFPE

    const recursion = await circomkit.WitnessTester('error_rec', {file: 'errors', template: 'Recursion'}, 'c');
    await recursion.expectFail({in: 100000}); // stack overflow
  });
});

describe('witness tester with another prime', () => {
  // goldilocks has 8-byte field elements, instead of 32 bytes as in bn128
  const circomkit = new Circomkit({
    verbose: false,
    logLevel: 'silent',
    prime: 'goldilocks',
    dirCircuits: './tests/circuits',
    dirBuild: './tests/build',
  });

  it('should check constraints', async () => {
    const circuit = await circomkit.WitnessTester('mul3_goldilocks', {
      file: 'multiplier',
      template: 'Multiplier',
      params: [3],
    });
    await circuit.expectPass({in: [2, 3, 5]}, {out: 30});

    const witness = await circuit.calculateWitness({in: [2, 3, 5]});
    await circuit.expectConstraintFail(await circuit.editWitness(witness, {'main.out': 31n}));
  });
});

describe('witness tester optimization level', () => {
  const dirBuild = './tests/build/optimization';
  const dirCircuits = `${dirBuild}/circuits`;
  const config = {file: 'linear', template: 'Linear'};

  beforeAll(() => {
    // `mid` is linear in `a`, which O2 substitutes away but O1 keeps
    mkdirSync(dirCircuits, {recursive: true});
    writeFileSync(
      `${dirCircuits}/linear.circom`,
      'pragma circom 2.0.0;\n' +
        'template Linear() { signal input a; signal input b; signal mid; signal output out; mid <== a + 1; out <== mid * b; }\n'
    );
  });

  it('should cap the global optimization at O1', async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits, dirBuild, optimization: 2});
    const circuit = await circomkit.WitnessTester('linear', {...config});
    expect(await circuit.getConstraintCount()).toBe(2);
  });

  it('should use the optimization of the circuit overrides', async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits, dirBuild});
    const circuit = await circomkit.WitnessTester('linear', {...config, overrides: {optimization: 2}});
    expect(await circuit.getConstraintCount()).toBe(1);
    await circuit.expectPass({a: 2, b: 3}, {out: 9});
  });

  afterAll(() => rmSync(dirBuild, {recursive: true, force: true}));
});

describe('witness tester in an ESM project', () => {
  // Circom generates a CommonJS `witness_calculator.js`, which `"type": "module"` would make an ES module
  const dirBuild = './tests/build/esm-project';

  beforeAll(() => {
    mkdirSync(dirBuild, {recursive: true});
    writeFileSync(`${dirBuild}/package.json`, JSON.stringify({type: 'module'}));
  });

  it('should compute witnesses', async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits: './tests/circuits', dirBuild});
    const circuit = await circomkit.WitnessTester('mul3_esm', {
      file: 'multiplier',
      template: 'Multiplier',
      params: [3],
    });
    await circuit.expectPass({in: [2, 3, 5]}, {out: 30});
  });

  afterAll(() => rmSync(dirBuild, {recursive: true, force: true}));
});
