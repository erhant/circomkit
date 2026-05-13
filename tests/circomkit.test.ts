import hre from 'hardhat';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import solc from 'solc';
import {Circomkit} from '../src';
import {existsSync, rmSync, readFileSync} from 'fs';
import {PTAU_PATH, prepareMultiplier} from './common';
import {PROTOCOLS} from '../src/configs';

describe('circomkit', () => {
  // we are not testing all curves because PTAU is only available for bn128
  PROTOCOLS.map(protocol =>
    describe('protocol: ' + protocol, () => {
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
        const source = readFileSync(path, {encoding: 'utf-8'})
          // XXX: snarkjs plonk template has an erroneous hardhat import
          //      See https://github.com/iden3/snarkjs/pull/464
          //      @todo Remove this fix when the PR is merged
          .replace('import "hardhat/console.sol";\n', '');

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
                '*': ['abi', 'evm.bytecode.object'],
              },
            },
          },
        };

        const output = JSON.parse(solc.compile(JSON.stringify(input)));
        const contractName = Object.keys(output.contracts['TestVerifier.sol'])[0];
        const bytecode = output.contracts['TestVerifier.sol'][contractName].evm.bytecode.object;
        const abi = output.contracts['TestVerifier.sol'][contractName].abi;

        // deploy the contract
        const signer = (await hre.ethers.getSigners())[0];
        const ContractFactory = new hre.ethers.ContractFactory(abi, bytecode, signer);
        const contract = await ContractFactory.deploy();
        await contract.waitForDeployment();

        // interaction with the contract
        const calldata = await circomkit.calldata(circuit.name, inputName);
        const args = calldata
          .split('\n')
          .filter(x => !!x)
          .map(x => JSON.parse(x));

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        expect(await contract.verifyProof(...args)).toBe(true);
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

describe('instantiate version fallback (#123)', () => {
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
