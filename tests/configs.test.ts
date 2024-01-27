/* eslint-disable @typescript-eslint/ban-ts-comment */
import {expect} from 'chai';
import {Circomkit} from '../src';
import {existsSync, rmSync} from 'fs';
import forEach from 'mocha-each';

describe('overriding configurations', () => {
  it('should override default configs', () => {
    const circomkit = new Circomkit({prime: 'goldilocks'});
    expect(circomkit.config.prime).to.eq('goldilocks');
  });

  it('should NOT allow an invalid prime', () => {
    // @ts-expect-error
    expect(() => new Circomkit({prime: 'fhdskfhjdk'})).to.throw('Invalid prime in configuration.');
  });

  it('should NOT allow an invalid protocol', () => {
    // @ts-expect-error
    expect(() => new Circomkit({protocol: 'fhdskfhjdk'})).to.throw('Invalid protocol in configuration.');
  });
});

describe('circomkit with custom circuits dir', () => {
  let circomkit: Circomkit;
  const dirCircuits = './circuits/fibonacci';
  const testcase = {file: 'vanilla', circuit: 'fibo_vanilla', input: 'vanilla'};

  before(() => {
    circomkit = new Circomkit({
      protocol: 'groth16',
      verbose: false,
      logLevel: 'silent',
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
    expect(existsSync(dirCircuits + '/test/' + testcase.circuit + '.circom')).to.be.true;
  });
});

describe('configuring the C witness generator', () => {
  const CONFIG = {verbose: false, logLevel: 'silent'} as const;
  const CIRCUIT_NAME = 'multiplier_3';

  it('should not generate the C witness calculators by default', async () => {
    const circomkit = new Circomkit({...CONFIG});
    expect(circomkit.config.cWitness).to.be.false;

    const outPath = await circomkit.compile(CIRCUIT_NAME);
    expect(existsSync(`${outPath}/${CIRCUIT_NAME}_cpp`)).to.be.false;
  });

  it('should generate the C witness calculators if specified', async () => {
    const circomKitCWitness = new Circomkit({...CONFIG, cWitness: true});
    const outPath = await circomKitCWitness.compile(CIRCUIT_NAME);
    expect(existsSync(`${outPath}/${CIRCUIT_NAME}_cpp`)).to.be.true;

    rmSync(`${outPath}/${CIRCUIT_NAME}_cpp`, {recursive: true});
  });
});

describe('compiling under different directories', () => {
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

  forEach(cases).describe('circomkit with explicit config & input (%(circuit)s)', testcase => {
    let circomkit: Circomkit;

    before(() => {
      circomkit = new Circomkit({
        protocol: 'groth16',
        verbose: false,
        logLevel: 'silent',
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
      expect(existsSync(path)).to.be.true;
    });

    it('should verify the proof', async () => {
      const isVerified = await circomkit.verify(testcase.circuit, testcase.input);
      expect(isVerified).to.be.true;
    });
  });
});
