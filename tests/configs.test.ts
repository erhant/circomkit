import {existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {Circomkit} from '../src';
import {DEFAULT} from '../src/configs';
import {circomVersion, requireCircom} from '../src/functions';
import {initProject} from '../src/utils/init';

describe('overriding configurations', () => {
  it('should override default configs', () => {
    const circomkit = new Circomkit({prime: 'goldilocks'});
    expect(circomkit.config.prime).toEqual('goldilocks');
  });

  it('should NOT allow an invalid prime', () => {
    // @ts-expect-error
    expect(() => new Circomkit({prime: 'fhdskfhjdk'})).toThrow('Invalid prime in configuration.');
  });

  it('should NOT allow an invalid protocol', () => {
    // @ts-expect-error
    expect(() => new Circomkit({protocol: 'fhdskfhjdk'})).toThrow('Invalid protocol in configuration.');
  });
});

describe('json schema', () => {
  const schema = JSON.parse(readFileSync('./schema.json', 'utf-8'));

  it('should list every config option', () => {
    const options = Object.keys(schema.properties).filter(key => key !== '$schema');
    expect(options.sort()).toEqual(Object.keys(DEFAULT).sort());
  });

  it('should list every overridable config option', () => {
    const overrides = Object.keys(schema.definitions.circuit.properties.overrides.properties);
    const expected = Object.keys(DEFAULT).filter(key => key !== 'circuits' && key !== 'logLevel');
    expect(overrides.sort()).toEqual(expected.sort());
  });

  it('should not read `$schema` as a circuit', () => {
    const circomkit = new Circomkit({circuits: './tests/circuits.json', logLevel: 'silent'});
    expect(Object.keys(circomkit.readCircuits())).not.toContain('$schema');
  });
});

describe('circomkit with custom circuits dir', () => {
  let circomkit: Circomkit;
  const dirCircuits = './tests/circuits/fibonacci';
  const testcase = {file: 'vanilla', circuit: 'fibo_vanilla', input: 'vanilla'};

  beforeAll(() => {
    circomkit = new Circomkit({
      protocol: 'groth16',
      verbose: false,
      logLevel: 'silent',
      circuits: './tests/circuits.json',
      dirPtau: './tests/ptau',
      dirInputs: './tests/inputs',
      dirBuild: './tests/build',
      dirCircuits,
    });
  });

  it('should instantiate under the custom circuits directory', async () => {
    await circomkit.compile(testcase.circuit, {
      file: testcase.file,
      template: 'Fibonacci',
      params: [7],
    });

    await circomkit.info(testcase.circuit);
    expect(existsSync(`${dirCircuits}/test/${testcase.circuit}.circom`)).toBe(true);
  });
});

describe('configuring the C witness generator', () => {
  const CONFIG = {
    verbose: false,
    logLevel: 'silent',
    dirPtau: './tests/ptau',
    dirInputs: './tests/inputs',
    dirBuild: './tests/build',
    dirCircuits: './tests/circuits',
    circuits: './tests/circuits.json',
  } as const;
  const CIRCUIT_NAME = 'multiplier_3';

  it('should not generate the C witness calculators by default', async () => {
    const circomkit = new Circomkit({...CONFIG});
    expect(circomkit.config.cWitness).toBe(false);

    const outPath = await circomkit.compile(CIRCUIT_NAME);
    expect(existsSync(`${outPath}/${CIRCUIT_NAME}_cpp`)).toBe(false);
  });

  it('should generate the C witness calculators if specified', async () => {
    // separate build dir, otherwise the C witness calculator may leak into other tests
    const circomKitCWitness = new Circomkit({...CONFIG, cWitness: true, dirBuild: './tests/build/cwitness'});
    const outPath = await circomKitCWitness.compile(CIRCUIT_NAME);
    expect(existsSync(`${outPath}/${CIRCUIT_NAME}_cpp`)).toBe(true);

    rmSync(`${outPath}/${CIRCUIT_NAME}_cpp`, {recursive: true});
  });
});

describe('compiling circuits with custom_templates', () => {
  const CONFIG = {
    verbose: false,
    logLevel: 'silent',
    dirPtau: './tests/ptau',
    dirInputs: './tests/inputs',
    dirBuild: './tests/build',
    dirCircuits: './tests/circuits',
    circuits: './tests/circuits.json',
  } as const;
  const CIRCUIT_NAME = 'uses_custom_templates';

  it('should compile correctly', async () => {
    const circomkit = new Circomkit({...CONFIG});

    const outPath = await circomkit.compile(CIRCUIT_NAME);
    expect(existsSync(`${outPath}/${CIRCUIT_NAME}_js`)).toBe(true);
    rmSync(`${outPath}/${CIRCUIT_NAME}_js`, {recursive: true});
  });
});

describe('compiling under different directories', () => {
  // Fibonacci circuits have only addition constraints so
  // optimization levels >= 2 result in zero constraints and an invalid r1cs
  const optimizationLevels = [0, 1];

  const cases = [
    {
      file: 'fibonacci/vanilla',
      circuit: 'fibo_vanilla',
      input: 'vanilla',
    },
    {
      file: 'fibonacci/recursive',
      circuit: 'fibo_recursive',
      input: 'recursive',
    },
  ] as const;

  optimizationLevels.map(optimization =>
    cases.map(testcase =>
      describe(`circomkit with explicit config (--O${optimization}) & input (${testcase.circuit})`, () => {
        let circomkit: Circomkit;

        beforeAll(() => {
          circomkit = new Circomkit({
            protocol: 'groth16',
            optimization,
            verbose: false,
            logLevel: 'silent',
            circuits: './tests/circuits.json',
            dirPtau: './tests/ptau',
            dirCircuits: './tests/circuits',
            dirInputs: './tests/inputs',
            dirBuild: `./tests/build/o${optimization}`,
          });
        });

        it('should compile with custom config', async () => {
          await circomkit.compile(testcase.circuit, {
            file: testcase.file,
            template: 'Fibonacci',
            params: [7],
          });

          await circomkit.info(testcase.circuit);
        });

        it('should prove with custom input data', async () => {
          const path = await circomkit.prove(testcase.circuit, testcase.input, {in: [1, 1]});
          expect(existsSync(path)).toBe(true);
        });

        it('should verify the proof', async () => {
          const isVerified = await circomkit.verify(testcase.circuit, testcase.input);
          expect(isVerified).toBe(true);
        });
      })
    )
  );
});

describe('inline circuits with per-circuit overrides', () => {
  const circomkit = new Circomkit({
    protocol: 'groth16',
    verbose: false,
    logLevel: 'silent',
    dirPtau: './tests/ptau',
    dirCircuits: './tests/circuits',
    dirInputs: './tests/inputs',
    dirBuild: './tests/build/overrides',
    circuits: {
      mul_plonk: {file: 'multiplier', template: 'Multiplier', params: [3], overrides: {protocol: 'plonk'}},
      mul_groth16: {file: 'multiplier', template: 'Multiplier', params: [3], dir: 'test/overrides'},
    },
  });

  afterAll(() => circomkit.clear('mul_plonk'));

  it('should accept bigint params in inline circuits', () => {
    const params = [BigInt(3)];
    const withBigInt = new Circomkit({circuits: {mul: {file: 'multiplier', template: 'Multiplier', params}}});
    expect(withBigInt.readCircuitConfig('mul').params).toEqual(params);
  });

  it('should apply overrides on top of the global config', () => {
    const config = circomkit.resolve('mul_plonk');
    expect(config.protocol).toBe('plonk');
    expect(config.optimization).toBe(1); // required by PLONK
    expect(circomkit.config.protocol).toBe('groth16');
    expect(circomkit.resolve('mul_groth16')).toBe(circomkit.config);
  });

  it('should setup, prove & verify with the overridden protocol', async () => {
    const {verifierKeyPath} = await circomkit.setup('mul_plonk');
    expect(verifierKeyPath).toBe('./tests/build/overrides/mul_plonk/plonk_vkey.json');
    expect(JSON.parse(readFileSync(verifierKeyPath, 'utf-8')).protocol).toBe('plonk');

    await circomkit.prove('mul_plonk', 'default', {in: [2, 3, 5]});
    expect(await circomkit.verify('mul_plonk', 'default')).toBe(true);
  });

  it('should not rewrite an unchanged main component', async () => {
    const path = circomkit.instantiate('mul_groth16');
    const mtime = statSync(path).mtimeMs;
    await new Promise(resolve => setTimeout(resolve, 20));
    circomkit.instantiate('mul_groth16');
    expect(statSync(path).mtimeMs).toBe(mtime);
  });

  it('should clear the main component under the circuit dir', async () => {
    const path = circomkit.instantiate('mul_groth16');
    expect(path).toBe('./tests/circuits/test/overrides/mul_groth16.circom');
    await circomkit.clear('mul_groth16');
    expect(existsSync(path)).toBe(false);
  });
});

describe('circom version checks', () => {
  it('should read the circom version', async () => {
    expect(await circomVersion('circom')).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should require a minimum circom version for a feature', async () => {
    const fakeCircom = './tests/build/fake-circom';
    mkdirSync('./tests/build', {recursive: true});
    writeFileSync(fakeCircom, '#!/bin/sh\necho "circom compiler 2.1.5"\n', {mode: 0o755});

    await requireCircom(fakeCircom, '2.1.5', 'Feature');
    await requireCircom(fakeCircom, '2.0.9', 'Feature');
    await expect(requireCircom(fakeCircom, '2.2.2', 'Feature')).rejects.toThrow(
      `Feature requires Circom 2.2.2 or newer, found 2.1.5 (${fakeCircom})`
    );
    await expect(requireCircom(fakeCircom, '2.1.10', 'Feature')).rejects.toThrow();
  });
});

describe('compiling the same circuit file many times', () => {
  for (const protocol of ['plonk', 'fflonk'] as const) {
    it(`should prove & verify with ${protocol}, sequentially and in parallel`, async () => {
      const circomkit = new Circomkit({
        protocol,
        verbose: false,
        logLevel: 'silent',
        dirPtau: './tests/ptau',
        dirCircuits: './tests/circuits',
        dirInputs: './tests/build/same-file/inputs',
        dirBuild: `./tests/build/same-file/${protocol}`,
        circuits: {
          mul3: {file: 'multiplier', template: 'Multiplier', params: [3], dir: 'test/same-file'},
          mul4: {file: 'multiplier', template: 'Multiplier', params: [4], dir: 'test/same-file'},
        },
      });
      const run = async (circuit: 'mul3' | 'mul4') => {
        await circomkit.compile(circuit);
        await circomkit.setup(circuit);
        await circomkit.prove(circuit, protocol, {in: circuit === 'mul3' ? [2, 3, 5] : [2, 3, 5, 7]});
        return circomkit.verify(circuit, protocol);
      };

      expect([await run('mul3'), await run('mul3')]).toEqual([true, true]);
      expect(await Promise.all([run('mul3'), run('mul4')])).toEqual([true, true]);
    });
  }
});

describe('init', () => {
  const dir = './tests/build/init';

  beforeAll(() => rmSync(dir, {recursive: true, force: true}));

  it('should create a project that works, without overwriting files', async () => {
    const {created, skipped} = initProject(dir);
    expect(created).toHaveLength(4);
    expect(skipped).toHaveLength(0);
    expect(initProject(dir)).toEqual({created: [], skipped: created});

    const {circuits} = JSON.parse(readFileSync(`${dir}/circomkit.json`, 'utf-8'));
    const circomkit = new Circomkit({
      verbose: false,
      logLevel: 'silent',
      circuits,
      dirCircuits: `${dir}/circuits`,
      dirBuild: `${dir}/build`,
    });
    const circuit = await circomkit.WitnessTester('multiplier_3', circomkit.readCircuitConfig('multiplier_3'));
    const input = JSON.parse(readFileSync(`${dir}/inputs/multiplier_3/default.json`, 'utf-8'));
    await circuit.expectPass(input, {out: 30});
  });
});
