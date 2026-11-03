import {existsSync, readFileSync, rmSync} from 'node:fs';
import {createEVM} from '@ethereumjs/evm';
import * as snarkjs from 'snarkjs';
// @ts-expect-error
import solc from 'solc';
import {Circomkit} from '../src';
import {PROTOCOLS} from '../src/configs';
import {PTAU_PATH, prepareMultiplier} from './common';

describe('circomkit', () => {
  // we are not testing all curves because PTAU is only available for bn128
  PROTOCOLS.map(protocol =>
    describe(`protocol: ${protocol}`, () => {
      let circomkit: Circomkit;
      const {circuit, signals, inputName} = prepareMultiplier(3);

      beforeAll(() => {
        circomkit = new Circomkit({
          protocol,
          verbose: false,
          logLevel: 'silent',
          circuits: './tests/circuits.json',
          dirPtau: './tests/ptau',
          dirCircuits: './tests/circuits',
          dirInputs: './tests/inputs',
          dirBuild: './tests/build',
        });
      });

      it('should instantiate circuit', () => {
        const path = circomkit.instantiate(circuit.name, circuit.config);
        expect(existsSync(path)).toBe(true);
        rmSync(path); // remove it to see if compile command creates it too
      });

      it('should compile circuit', async () => {
        const outPath = await circomkit.compile(circuit.name);
        expect(existsSync(`${outPath}/${circuit.name}_js`)).toBe(true); // js is built by default
        expect(existsSync(`${outPath}/${circuit.name}_cpp`)).toBe(false); // cpp is NOT built by default
      });

      it('should format constraints', async () => {
        const constraints = circomkit.constraints(circuit.name);
        expect(constraints).toHaveLength((await circomkit.info(circuit.name)).constraints);
        expect(constraints[0]).toBe('in[0] * in[1] = inner[0]');
      });

      it('should export circuit information', async () => {
        await circomkit.info(circuit.name);
      });

      it('should setup circuit', async () => {
        const {proverKeyPath, verifierKeyPath} = await circomkit.setup(circuit.name, PTAU_PATH);
        expect(existsSync(proverKeyPath)).toBe(true);
        expect(existsSync(verifierKeyPath)).toBe(true);
      });

      it('should export a verification key given a circuit name and a prover key path', async () => {
        const {proverKeyPath} = await circomkit.setup(circuit.name, PTAU_PATH);
        const vkeyPath = await circomkit.vkey(circuit.name, proverKeyPath);
        expect(existsSync(vkeyPath)).toBe(true);
      });

      it('should export a verification key given a circuit name', async () => {
        const vkeyPath = await circomkit.vkey(circuit.name);
        expect(existsSync(vkeyPath)).toBe(true);
      });

      it('should throw when exporting a verification key given an invalid prover key path', async () => {
        try {
          await circomkit.vkey(circuit.name, 'non-existent-path');
        } catch (err) {
          expect((err as Error).message).toBe(
            'There must be a prover key for this circuit to extract a verification key.'
          );
        }
      });

      it('should create an input', async () => {
        const path = circomkit.input(circuit.name, inputName, signals.input);
        expect(existsSync(path)).toBe(true);
      });

      it('should create a witness', async () => {
        const path = await circomkit.witness(circuit.name, inputName);
        expect(existsSync(path)).toBe(true);
      });

      it('should create a proof', async () => {
        const path = await circomkit.prove(circuit.name, inputName);
        expect(existsSync(path)).toBe(true);
      });

      it('should verify the proof', async () => {
        const isVerified = await circomkit.verify(circuit.name, inputName);
        expect(isVerified).toBe(true);
      });

      it('should export verifier contract and valid calldata', async () => {
        const path = await circomkit.contract(circuit.name);
        expect(existsSync(path)).toBe(true);
        const source = readFileSync(path, {encoding: 'utf-8'});

        // compile the contract
        const input = {
          language: 'Solidity',
          sources: {
            'TestVerifier.sol': {
              content: source,
            },
          },
          settings: {
            outputSelection: {
              '*': {
                '*': ['evm.bytecode.object', 'evm.methodIdentifiers'],
              },
            },
          },
        };

        const output = JSON.parse(solc.compile(JSON.stringify(input)));
        const contract = Object.values(output.contracts['TestVerifier.sol'])[0] as {
          evm: {bytecode: {object: string}; methodIdentifiers: Record<string, string>};
        };
        const selector = Object.entries(contract.evm.methodIdentifiers).find(([f]) => f.startsWith('verifyProof('))![1];

        // deploy the contract
        const evm = await createEVM();
        const gasLimit = 30_000_000n;
        const deployment = await evm.runCall({data: Buffer.from(contract.evm.bytecode.object, 'hex'), gasLimit});
        expect(deployment.execResult.exceptionError).toBeUndefined();

        // all arguments of `verifyProof` are fixed-size arrays of words, so their ABI encoding is
        // simply the words one after another
        const verifyProof = async (words: string[]) => {
          const args = words.map(w => BigInt(w).toString(16).padStart(64, '0')).join('');
          const call = await evm.runCall({
            to: deployment.createdAddress,
            data: Buffer.from(selector + args, 'hex'),
            gasLimit,
          });
          expect(call.execResult.exceptionError).toBeUndefined();
          return BigInt(`0x${Buffer.from(call.execResult.returnValue).toString('hex')}`) === 1n;
        };

        const calldata = await circomkit.calldata(circuit.name, inputName);
        const words: string[] = calldata
          .split('\n')
          .filter(x => !!x)
          .flatMap(x => JSON.parse(x).flat(2));
        expect(await verifyProof(words)).toBe(true);

        // a different public signal must not verify
        expect(await verifyProof([...words.slice(0, -1), '0x1'])).toBe(false);
      });

      it('should export JSON files', async () => {
        await circomkit.json('r1cs', circuit.name);
        await circomkit.json('wtns', circuit.name, inputName);

        try {
          await circomkit.json('zkey', circuit.name);

          // only groth16 is allowed to export zkey
          if (protocol !== 'groth16') {
            throw new Error('Should have thrown an error before this.');
          }
        } catch (err) {
          expect((err as Error).message).toBe('Exporting zKey to JSON is only supported for Groth16 at the moment.');
        }
      });
    })
  );
});

describe('instantiate version fallback', () => {
  const {circuit} = prepareMultiplier(3);
  const baseConfig = {
    verbose: false,
    logLevel: 'silent' as const,
    circuits: './tests/circuits.json',
    dirPtau: './tests/ptau',
    dirCircuits: './tests/circuits',
    dirInputs: './tests/inputs',
    dirBuild: './tests/build',
  };

  it('should use this.config.version when circuitConfig has no version field', () => {
    const customVersion = '2.1.9';
    const circomkit = new Circomkit({...baseConfig, version: customVersion});

    const path = circomkit.instantiate('multiplier_version_fallback', circuit.config);
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain(`pragma circom ${customVersion};`);

    rmSync(path);
  });

  it('should prefer circuitConfig.version over this.config.version', () => {
    const circomkit = new Circomkit({...baseConfig, version: '2.1.9'});

    const path = circomkit.instantiate('multiplier_version_override', {
      ...circuit.config,
      version: '2.2.0',
    });
    const content = readFileSync(path, 'utf-8');
    expect(content).toContain('pragma circom 2.2.0;');

    rmSync(path);
  });
});

// the C witness calculator needs nlohmann-json, gmp and nasm, which CI installs on Linux
(process.platform === 'linux' ? describe : describe.skip)('witness with the C calculator', () => {
  const {circuit, signals, inputName} = prepareMultiplier(3);
  const circomkit = new Circomkit({
    verbose: false,
    logLevel: 'silent',
    circuits: './tests/circuits.json',
    dirPtau: './tests/ptau',
    dirCircuits: './tests/circuits',
    dirInputs: './tests/inputs',
    dirBuild: './tests/build/cwitness',
  });

  it('should match the WASM witness', async () => {
    circomkit.input(circuit.name, inputName, signals.input);
    const wasmWtns = await snarkjs.wtns.exportJson(await circomkit.witness(circuit.name, inputName));
    const cWtns = await snarkjs.wtns.exportJson(await circomkit.witness(circuit.name, inputName, undefined, 'c'));
    const cDataWtns = await snarkjs.wtns.exportJson(
      await circomkit.witness(circuit.name, inputName, signals.input, 'c')
    );
    expect(cWtns).toEqual(wasmWtns);
    expect(cDataWtns).toEqual(wasmWtns);
  });

  it('should create the main component where the CLI does', async () => {
    const inline = new Circomkit({
      verbose: false,
      logLevel: 'silent',
      dirCircuits: './tests/circuits',
      dirBuild: './tests/build/cwitness-dir',
      circuits: {mul3_cdir: {file: 'multiplier', template: 'Multiplier', params: [3]}},
    });
    await inline.witness('mul3_cdir', 'default', {in: [2, 3, 5]}, 'c');
    expect(existsSync('./tests/circuits/main/mul3_cdir.circom')).toBe(true);
    expect(existsSync('./tests/circuits/test/mul3_cdir.circom')).toBe(false);
  });
});
