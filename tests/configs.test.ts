import {expect} from 'chai';
import {Circomkit} from '../src';

describe('config overrides', () => {
  it('should override default configs', async () => {
    const circomkit = new Circomkit({
      curve: 'goldilocks',
    });
    expect(circomkit.config.curve).to.eq('goldilocks');
  });

  it('should NOT allow an invalid curve', async () => {
    expect(
      () =>
        new Circomkit({
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          curve: 'fhdskfhjdk',
        })
    ).to.throw('Invalid curve in configuration.');
  });

  it('should NOT allow an invalid protocol', async () => {
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
