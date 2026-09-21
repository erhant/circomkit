import {getSnarkjsOptions} from '../src/utils';

describe('getSnarkjsOptions', () => {
  it('enables single-threaded proving for Bun', () => {
    expect(getSnarkjsOptions({Bun: {}})).toEqual({singleThread: true});
  });

  it('uses the default prover options for other runtimes', () => {
    expect(getSnarkjsOptions({})).toBeUndefined();
  });
});
