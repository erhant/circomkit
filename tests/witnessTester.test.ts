import {mkdirSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync} from 'node:fs';
import * as snarkjs from 'snarkjs';
import {Circomkit, type WitnessTester} from '../src';
import {circomVersion, requireCircom} from '../src/functions';
import type {WitnessType} from '../src/types';
import {primes} from '../src/utils';
import {C_WITNESS, prepareMultiplier} from './common';

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

  it('should format constraints', async () => {
    expect(await circuit.constraints()).toEqual([
      'in[0] * in[1] = inner[0]',
      'inner[0] * in[2] = inner[1]',
      'inner[1] * in[3] = out',
      ...[0, 1, 2, 3].map(i => `isZero[${i}].in * isZero[${i}].inv = 1`),
      ...[0, 1, 2, 3].map(i => `in[${i}] - isZero[${i}].in - 1 = 0`),
    ]);
  });

  it('should filter constraints by signal or component', async () => {
    expect(await circuit.constraints('isZero[1]')).toEqual([
      '#4: isZero[1].in * isZero[1].inv = 1',
      '#8: in[1] - isZero[1].in - 1 = 0',
    ]);
    expect(await circuit.constraints('main.out')).toEqual(['#2: inner[1] * in[3] = out']);
    expect(await circuit.constraints('in[1]')).toEqual([
      '#0: in[0] * in[1] = inner[0]',
      '#8: in[1] - isZero[1].in - 1 = 0',
    ]);
    await expect(circuit.constraints('isZero[9]')).rejects.toThrow('No signal matches isZero[9]');
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
(C_WITNESS ? describe : describe.skip)('witness tester with the C calculator', () => {
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

describe('witness tester with other primes', () => {
  // goldilocks has 8-byte field elements, instead of 32 bytes as in bn128
  for (const [prime, since] of [
    ['goldilocks', '2.0.6'],
    ['bls12377', '2.2.2'],
  ] as const) {
    it(`should check constraints with ${prime}`, async () => {
      const circomkit = new Circomkit({
        verbose: false,
        logLevel: 'silent',
        prime,
        dirCircuits: './tests/circuits',
        dirBuild: './tests/build',
      });
      const tester = () =>
        circomkit.WitnessTester(`mul3_${prime}`, {file: 'multiplier', template: 'Multiplier', params: [3]});

      const supported = await requireCircom('circom', since, '').then(
        () => true,
        () => false
      );
      if (!supported) {
        // instead of Circom's "invalid prime number"
        await expect(tester()).rejects.toThrow(`The ${prime} prime requires Circom ${since} or newer`);
        return;
      }

      const circuit = await tester();
      // -1 is p - 1 in the field of the prime
      await circuit.expectPass({in: [-1, 2, 3]}, {out: primes[prime] - 6n});

      const witness = await circuit.calculateWitness({in: [2, 3, 5]});
      await circuit.expectConstraintFail(await circuit.editWitness(witness, {'main.out': 31n}));
    });
  }
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

  it('should use the optimization of the circuit overrides with PLONK too', async () => {
    // PLONK needs O1 to prove, but not to compute witnesses
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits, dirBuild, protocol: 'plonk'});
    const circuit = await circomkit.WitnessTester('linear', {...config, overrides: {optimization: 2}});
    expect(await circuit.getConstraintCount()).toBe(1);
  });

  it('should compare expected outputs in the field', async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits, dirBuild});
    const circuit = await circomkit.WitnessTester('linear', {...config});
    await circuit.expectPass({a: -3, b: 5}, {out: -10});
    await circuit.expectPass({a: 2, b: 3}, {out: '0x9'});
    await circuit.expectPass({a: 2, b: 3}, {out: primes.bn128 + 9n});
    await expect(circuit.expectPass({a: -3, b: 5}, {out: 10})).rejects.toThrow('expected 10, got');
    await expect(circuit.expectPass({a: 2, b: 3}, {out: -9})).rejects.toThrow(
      `expected -9 (${primes.bn128 - 9n} in the field), got 9`
    );
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

describe('witness testers of the same circuit', () => {
  const dirBuild = './tests/build/same-circuit';

  beforeAll(() => rmSync(dirBuild, {recursive: true, force: true}));

  it('should compile concurrently', async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits: './tests/circuits', dirBuild});
    const config = {file: 'multiplier', template: 'Multiplier', params: [3]};
    await Promise.all(
      Array.from({length: 4}, async () => {
        const circuit = await circomkit.WitnessTester('mul3_concurrent', {...config});
        await circuit.expectPass({in: [2, 3, 5]}, {out: 30});
      })
    );
    expect(readdirSync(`${dirBuild}/.witness-tester`)).toHaveLength(1);
  });

  it('should compile concurrently with different parameters', async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits: './tests/circuits', dirBuild});
    // all write the same `main` component, which must not change what the others compile
    await Promise.all(
      [2, 3, 4, 5].map(async n => {
        const circuit = await circomkit.WitnessTester('mul_concurrent', {
          file: 'multiplier',
          template: 'Multiplier',
          params: [n],
        });
        const inputs = Array.from({length: n}, (_, i) => i + 2);
        await circuit.expectPass({in: inputs}, {out: inputs.reduce((a, b) => a * b)});
      })
    );
  });

  it('should include the circuit relative to the main component, for any directory', async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits: './tests/circuits', dirBuild});
    for (const dir of ['test/', './test', 'test/same-circuit/']) {
      const circuit = await circomkit.WitnessTester('mul_dir', {
        file: 'multiplier',
        template: 'Multiplier',
        params: [2],
        dir,
      });
      await circuit.expectPass({in: [2, 3]}, {out: 6});
    }
  });

  it('should not share builds of circuits from different directories', async () => {
    const outputs = await Promise.all(
      [1, 2].map(async factor => {
        const dirCircuits = `${dirBuild}/circuits-${factor}`;
        mkdirSync(dirCircuits, {recursive: true});
        writeFileSync(
          `${dirCircuits}/scale.circom`,
          `pragma circom 2.0.0;\ntemplate Scale() { signal input in; signal output out; out <== in * ${factor}; }\n`
        );
        const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits, dirBuild});
        const circuit = await circomkit.WitnessTester('scale', {file: 'scale', template: 'Scale'});
        return (await circuit.compute({in: 3}, ['out'])).out;
      })
    );
    expect(outputs).toEqual([3n, 6n]);
  });

  afterAll(() => rmSync(dirBuild, {recursive: true, force: true}));
});

describe('witnesses against snarkjs', () => {
  const dirBuild = './tests/build/witness-snarkjs';
  const calculators = C_WITNESS ? (['wasm', 'c'] as const) : (['wasm'] as const);
  afterAll(() => rmSync(dirBuild, {recursive: true, force: true}));

  for (const prime of ['bn128', 'goldilocks'] as const) {
    for (const calculator of calculators) {
      it(`should compute the same witness with ${prime} and the ${calculator} calculator`, async () => {
        const circomkit = new Circomkit({
          verbose: false,
          logLevel: 'silent',
          prime,
          dirCircuits: './tests/circuits',
          dirBuild,
        });
        const circuit = await circomkit.WitnessTester(
          `arrays_${prime}`,
          {file: 'arrays', template: 'Arrays', params: [2, 3], pubs: ['in1D', 'in2D']},
          calculator
        );
        const input = {
          in: 1,
          in1D: [1, 2],
          in2D: [
            [1, 2, 3],
            [5, 6, 7],
          ],
        };
        const witness = await circuit.calculateWitness(input);

        const dir = await circomkit.compile(`arrays_${prime}`, {
          file: 'arrays',
          template: 'Arrays',
          params: [2, 3],
          pubs: ['in1D', 'in2D'],
          dir: 'test',
        });
        const wtnsPath = `${dir}/snarkjs.wtns`;
        await snarkjs.wtns.calculate(input, `${dir}/arrays_${prime}_js/arrays_${prime}.wasm`, wtnsPath);
        expect(witness.map(BigInt)).toEqual(((await snarkjs.wtns.exportJson(wtnsPath)) as bigint[]).map(BigInt));
      });
    }
  }
});

// buses need Circom 2.2.0
const [major, minor] = (await circomVersion('circom')).split('.').map(Number);
(major > 2 || (major === 2 && minor >= 2) ? describe : describe.skip)('reading signals of many shapes', () => {
  const dirBuild = './tests/build/signals';
  let circuit: WitnessTester;
  let witness: WitnessType;
  const input = {
    in: [
      [1, 2, 3],
      [4, 5, 6],
    ],
    p: {x: 3, y: 7},
  };

  beforeAll(async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits: './tests/circuits', dirBuild});
    // O0 keeps all signals, O1 already removes linear ones such as `d[i][j].out`
    circuit = await circomkit.WitnessTester('signals', {
      file: 'signals',
      template: 'Signals',
      overrides: {optimization: 0},
    });
    witness = await circuit.calculateWitness(input as never);
  });
  afterAll(() => rmSync(dirBuild, {recursive: true, force: true}));

  const read = async (signal: string) => (await circuit.readWitnessSignals(witness, [signal]))[signal];

  it('should read multi-dimensional arrays', async () => {
    expect(await read('in')).toEqual([
      [1n, 2n, 3n],
      [4n, 5n, 6n],
    ]);
    expect(await read('out3')).toEqual([
      [
        [2n, 2n],
        [6n, 12n],
        [12n, 36n],
      ],
      [
        [20n, 80n],
        [30n, 150n],
        [42n, 252n],
      ],
    ]);
    expect(await read('out3[1][2]')).toEqual([42n, 252n]);
  });

  it('should read signals of component arrays', async () => {
    expect(await read('d[1][2].out')).toBe(42n);
    expect(await read('d[0]')).toEqual([
      {out: 2n, in: 1n, sq: 1n},
      {out: 6n, in: 2n, sq: 4n},
      {out: 12n, in: 3n, sq: 9n},
    ]);
  });

  it('should read buses', async () => {
    expect(await read('p')).toEqual({x: 3n, y: 7n});
    expect(await read('q')).toEqual({x: 21n, y: 10n});
    expect(await read('q.y')).toBe(10n);
    expect(await read('qs')).toEqual([
      {x: 3n, y: 147n},
      {x: 6n, y: 147n},
    ]);
    expect(await read('qs[1]')).toEqual({x: 6n, y: 147n});
  });

  it('should compute & assert outputs of all shapes', async () => {
    const output = await circuit.compute(input as never, ['sum', 'q', 'qs']);
    expect(output).toEqual({
      sum: 572n,
      q: {x: 21n, y: 10n},
      qs: [
        {x: 3n, y: 147n},
        {x: 6n, y: 147n},
      ],
    });
    await circuit.expectPass(input as never, output as never);
  });

  it('should not match signals by prefix', async () => {
    await expect(read('su')).rejects.toThrow('No symbols matched for signal: su');
    await expect(read('d[1][2].ou')).rejects.toThrow('No symbols matched for signal: d[1][2].ou');
  });
});
