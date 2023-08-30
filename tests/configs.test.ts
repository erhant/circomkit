import {expect} from 'chai';
import {Circomkit} from '../src';
import {existsSync} from 'fs';
import forEach from 'mocha-each';

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

// TODO: refactor this later, put this data elsewhere & better naming pls
type CustomCase = {
  file: string;
  circuit: string;
  input: string;
};

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
] as const).describe('circomkit with explicit config & input', (customCase: CustomCase) => {
  let circomkit: Circomkit;

  before(() => {
    circomkit = new Circomkit({
      protocol: 'groth16',
      verbose: false,
      logLevel: 'silent',
    });
  });

  it('should compile with custom config', async () => {
    await circomkit.compile(customCase.circuit, {
      file: customCase.file,
      template: 'Fibonacci',
      params: [7],
    });

    await circomkit.info(customCase.circuit);
  });

  it('should prove with custom input data', async () => {
    const path = await circomkit.prove(customCase.circuit, customCase.input, {
      in: [1, 1],
    });
    expect(existsSync(path)).to.be.true;
  });

  it('should verify the proof', async () => {
    const isVerified = await circomkit.verify(customCase.circuit, customCase.input);
    expect(isVerified).to.be.true;
  });
});
