import {Circomkit, WitnessTester} from '../src';

describe('errors', () => {
  let circuit: WitnessTester<['in', 'inin'], ['out']>;

  before(async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent'});
    circuit = await circomkit.WitnessTester('error_rt', {file: 'errors', template: 'Errors'});
  });

  it('should fail for fewer inputs than expected', async () => {
    await circuit.expectFail({in: 0, inin: [1]});
    // Not enough values for input signal inin
  });

  it('should fail for more inputs than expected', async () => {
    await circuit.expectFail({in: 0, inin: [1, 2, 3]});
    // Too many values for input signal inin
  });

  it('should fail due to false-assert', async () => {
    await circuit.expectFail({in: 1, inin: [1, 2]});
    // Error: Assert Failed.
  });

  it('should fail due to missing signal', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    await circuit.expectFail({inin: [1, 2]});
    // Not all inputs have been set. Only 2 out of 3.
  });

  it('should fail due to extra signal', async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    await circuit.expectFail({inin: [1, 2, 3], idontexist: 1});
    // Too many values for input signal inin
  });
});
