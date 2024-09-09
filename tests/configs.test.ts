/* eslint-disable @typescript-eslint/ban-ts-comment */
import {Circomkit} from '../src';
import {existsSync, rmSync} from 'fs';

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
    expect(existsSync(dirCircuits + '/test/' + testcase.circuit + '.circom')).toBe(true);
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
    const circomKitCWitness = new Circomkit({...CONFIG, cWitness: true});
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
