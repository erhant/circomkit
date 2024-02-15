import {Circomkit, WitnessTester} from '../src';
import {prepareMultiplier} from './common';
import {expect} from 'chai';

describe('witness tester', () => {
  let circuit: WitnessTester<['in'], ['out']>;
  const {
    circuit: {name, config, size, exact},
    signals,
  } = prepareMultiplier(4);

  before(async () => {
    const circomkit = new Circomkit({verbose: false, logLevel: 'silent'});
    circuit = await circomkit.WitnessTester(name, config);
  });

  it('should have correct number of constraints', async () => {
    await circuit.expectConstraintCount(size!, exact);

    // should also work for non-exact too, where we expect at least some amount
    await circuit.expectConstraintCount(size!);
    await circuit.expectConstraintCount(size! - 1);
  });

  it('should assert correctly', async () => {
    await circuit.expectPass(signals.input, signals.output);
  });

  it('should fail for fewer inputs than expected', async () => {
    await circuit.expectFail({in: signals.input.in.slice(1)});
  });

  it('should fail for more inputs than expected', async () => {
    await circuit.expectFail({in: [0, ...signals.input.in]});
  });

  it('should fail for bad witness', async () => {
    await circuit.expectFail(signals.badInput);
  });

  it('should compute correctly', async () => {
    const output = await circuit.compute(signals.input, ['out']);
    expect(output).to.haveOwnProperty('out');
    expect(output.out).to.eq(BigInt(signals.output.out));
  });

  it('should read witness correctly', async () => {
    const witness = await circuit.calculateWitness(signals.input);
    const symbol = 'main.out';
    const symbolValues = await circuit.readWitness(witness, [symbol]);
    expect(symbolValues).to.haveOwnProperty(symbol);
    expect(symbolValues[symbol]).to.eq(BigInt(signals.output.out));
  });

  it('should assert for correct witness', async () => {
    const witness = await circuit.calculateWitness(signals.input);
    await circuit.expectConstraintPass(witness);
  });

  it('should NOT assert for maliciously edited witness', async () => {
    // create a valid witness
    const witness = await circuit.calculateWitness(signals.input);
    // change the values so that it still computes correctly but is not sound
    const badWitness = await circuit.editWitness(witness, {
      'main.in[0]': 1n,
      'main.in[1]': 1n,
      'main.in[2]': BigInt(signals.output.out),
    });
    await circuit.expectConstraintFail(badWitness);
  });
});
