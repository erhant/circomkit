import {expect} from 'chai';
import {Circomkit} from '../src';
import forEach from 'mocha-each';
import {existsSync} from 'fs';

describe('circomkit config overrides', () => {
  it('should override default configs', () => {
    const circomkit = new Circomkit({
      prime: 'goldilocks',
    });
    expect(circomkit.config.prime).to.eq('goldilocks');
  });

  it('should NOT allow an invalid prime', () => {
    expect(
      () =>
        new Circomkit({
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          prime: 'fhdskfhjdk',
        })
    ).to.throw('Invalid prime in configuration.');
  });

  it('should NOT allow an invalid protocol', () => {
    expect(
      () =>
        new Circomkit({
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          protocol: 'fhdskfhjdk',
        })
    ).to.throw('Invalid protocol in configuration.');
  });
});

forEach([
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
] as const).describe('circomkit with explicit config & input', testcase => {
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
    const path = await circomkit.prove(testcase.circuit, testcase.input, {
      in: [1, 1],
    });
    expect(existsSync(path)).to.be.true;
  });

  it('should verify the proof', async () => {
    const isVerified = await circomkit.verify(testcase.circuit, testcase.input);
    expect(isVerified).to.be.true;
  });
});

describe('circomkit with custom circuits dir', () => {
  let circomkit: Circomkit;
  const dirCircuits = './circuits/fibonacci';
  const testcase = {
    file: 'vanilla',
    circuit: 'fibo_vanilla',
    input: 'vanilla',
  };

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
