import {expect} from 'chai';
import {Circomkit} from '../src';

describe('config overrides', () => {
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
