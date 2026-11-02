import {Circomkit, WitnessTester} from '../src';
import {mkdirSync, readdirSync, statSync, utimesSync, writeFileSync} from 'fs';
import {prepareMultiplier} from './common';

// TODO: add C tester

describe('witness tester', () => {
  let circomkit: Circomkit;
  let circuit: WitnessTester<['in'], ['out']>;
  const {
    circuit: {name, config, size, exact},
    signals,
  } = prepareMultiplier(4);

  beforeAll(async () => {
    circomkit = new Circomkit({
      verbose: false,
      logLevel: 'silent',
      circuits: './tests/circuits.json',
      dirPtau: './tests/ptau',
      dirCircuits: './tests/circuits',
      dirInputs: './tests/inputs',
      dirBuild: './tests/build',
      optimization: 2,
    });
    circuit = await circomkit.WitnessTester(name, {...config, recompile: true});
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

  it('should fail for bad witness', async () => {
    await circuit.expectFail(signals.badInput);
  });

  it('should compute correctly', async () => {
    const output = await circuit.compute(signals.input, ['out']);
    expect(output).toHaveProperty('out');
    expect(output.out).toEqual(BigInt(signals.output.out));
  });

  it('should compute correctly with multiple output signals', async () => {
    const N = 167;
    const newSize = N + N - 1;
    const a = 2;
    const b = 3;
    const aOut = Array(newSize)
      .fill(0)
      .map((_, i) => BigInt(i < N ? a * i : 0));
    const bOut = Array(newSize)
      .fill(0)
      .map((_, i) => BigInt(i < N ? b * i : 0));
    const cOut = Array(N).fill(BigInt(a * b));

    const circuit2 = await circomkit.WitnessTester('multiout', {
      file: 'multiout',
      template: 'Multiout',
      params: [N],
    });

    const input = {
      a: Array(N).fill(a),
      b: Array(N).fill(b),
    };
    const output = await circuit2.compute(input, ['aOut', 'bOut', 'cOut']);

    expect(output).toHaveProperty('aOut');
    expect(output).toHaveProperty('bOut');
    expect(output).toHaveProperty('cOut');
    expect(output.aOut).toHaveLength(newSize);
    expect(output.bOut).toHaveLength(newSize);
    expect(output.cOut).toHaveLength(N);
    expect(output.aOut).toEqual(aOut);
    expect(output.bOut).toEqual(bOut);
    expect(output.cOut).toEqual(cOut);

    await circuit2.expectPass(input, output);
  });

  it('should read witness correctly', async () => {
    const witness = await circuit.calculateWitness(signals.input);
    const symbol = 'main.out';
    const symbolValues = await circuit.readWitness(witness, [symbol]);
    expect(symbol in symbolValues).toBe(true);
    expect(symbolValues[symbol]).toEqual(BigInt(signals.output.out));
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
      'main.in[0]': BigInt(1),
      'main.in[1]': BigInt(1),
      'main.in[2]': BigInt(signals.output.out),
    });
    await circuit.expectConstraintFail(badWitness);
  });
});

describe('witness tester recompilation', () => {
  const dirBuild = './tests/build/recompile';
  const dirCircuits = `${dirBuild}/circuits`;
  const circomkit = new Circomkit({verbose: false, logLevel: 'silent', dirCircuits, dirBuild});
  const config = {file: 'top', template: 'Top'};

  /** Modification time of the tester's WASM, there must be exactly one build. */
  const builtAt = () => {
    const builds = readdirSync(`${dirBuild}/.witness-tester`);
    expect(builds).toHaveLength(1);
    return statSync(`${dirBuild}/.witness-tester/${builds[0]}/top_js/top.wasm`).mtimeMs;
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));

  beforeAll(() => {
    // `top` includes `lib`, which is not referenced by the main component directly
    mkdirSync(dirCircuits, {recursive: true});
    writeFileSync(
      `${dirCircuits}/lib.circom`,
      'pragma circom 2.0.0;\ntemplate Square() { signal input in; signal output out; out <== in * in; }\n'
    );
    writeFileSync(
      `${dirCircuits}/top.circom`,
      'pragma circom 2.0.0;\ninclude "lib.circom";\n' +
        'template Top() { signal input in; signal output out; out <== Square()(in); }\n'
    );
  });

  it('should not recompile an unchanged circuit', async () => {
    const circuit = await circomkit.WitnessTester('top', {...config});
    await circuit.expectPass({in: 3}, {out: 9});
    const firstBuild = builtAt();

    await tick();
    await circomkit.WitnessTester('top', {...config});
    expect(builtAt()).toBe(firstBuild);
  });

  it('should recompile when an included file changes', async () => {
    const before = builtAt();
    await tick();
    const now = new Date();
    utimesSync(`${dirCircuits}/lib.circom`, now, now);

    await circomkit.WitnessTester('top', {...config});
    expect(builtAt()).toBeGreaterThan(before);
  });

  it('should always recompile with recompile: true', async () => {
    const before = builtAt();
    await tick();
    await circomkit.WitnessTester('top', {...config, recompile: true});
    expect(builtAt()).toBeGreaterThan(before);
  });
});
