import {Circomkit, type WitnessTester} from '../src';

describe('errors', () => {
  let circuit: WitnessTester<['in', 'inin'], ['out']>;

  beforeAll(async () => {
    const circomkit = new Circomkit({
      verbose: false,
      logLevel: 'silent',
      circuits: './tests/circuits.json',
      dirPtau: './tests/ptau',
      dirCircuits: './tests/circuits',
      dirInputs: './tests/inputs',
      dirBuild: './tests/build',
    });
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
    // @ts-expect-error
    await circuit.expectFail({inin: [1, 2]});
    // Not all inputs have been set. Only 2 out of 3.
  });

  it('should fail due to extra signal', async () => {
    // @ts-expect-error
    await circuit.expectFail({inin: [1, 2, 3], idontexist: 1});
    // Too many values for input signal inin
  });
});

describe('runtime errors (#107)', () => {
  it('should fail due to modulo by zero', async () => {
    const circomkit = new Circomkit({
      verbose: false,
      logLevel: 'silent',
      dirCircuits: './tests/circuits',
      dirBuild: './tests/build',
    });
    const circuit = await circomkit.WitnessTester('error_mod', {file: 'errors', template: 'ModuloByZero'});
    await circuit.expectPass({in: 2}, {out: 1});
    const message = await circuit.expectFail({in: 0});
    expect(message.toLowerCase()).toContain('by zero');
  });

  it('should fail due to deep recursion', async () => {
    const circomkit = new Circomkit({
      verbose: false,
      logLevel: 'silent',
      dirCircuits: './tests/circuits',
      dirBuild: './tests/build',
    });
    const circuit = await circomkit.WitnessTester('error_rec', {file: 'errors', template: 'Recursion'});
    await circuit.expectPass({in: 10}, {out: 10});
    const message = await circuit.expectFail({in: 100000});
    expect(message.toLowerCase()).toContain('out of bounds');
  });
});
