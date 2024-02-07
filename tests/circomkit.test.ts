import forEach from 'mocha-each';
import {PROTOCOLS} from '../src/utils/config';
import {Circomkit} from '../src';
import {expect} from 'chai';
import {existsSync, rmSync} from 'fs';
import {PTAU_PATH, prepareMultiplier} from './common';

// we are not testing all curves because PTAU is only available for bn128
forEach(PROTOCOLS).describe('protocol: %s', (protocol: (typeof PROTOCOLS)[number]) => {
  let circomkit: Circomkit;
  const {circuit, signals, inputName} = prepareMultiplier(3);

  before(() => {
    circomkit = new Circomkit({protocol, verbose: false, logLevel: 'silent'});
  });

  it('should instantiate circuit', () => {
    const path = circomkit.instantiate(circuit.name, circuit.config);
    expect(existsSync(path)).to.be.true;
    rmSync(path); // remove it to see if compile command creates it too
  });

  it('should compile circuit', async () => {
    const outPath = await circomkit.compile(circuit.name);
    expect(existsSync(`${outPath}/${circuit.name}_js`)).to.be.true; // js is built by default
    expect(existsSync(`${outPath}/${circuit.name}_cpp`)).to.be.false; // cpp is NOT built by default
  });

  it('should export circuit information', async () => {
    await circomkit.info(circuit.name);
  });

  it('should setup circuit', async () => {
    const {proverKeyPath, verifierKeyPath} = await circomkit.setup(circuit.name, PTAU_PATH);
    expect(existsSync(proverKeyPath)).to.be.true;
    expect(existsSync(verifierKeyPath)).to.be.true;
  });

  it('should export a verification key given a circuit name and a prover key path', async () => {
    const {proverKeyPath} = await circomkit.setup(circuit.name, PTAU_PATH);
    const vkeyPath = await circomkit.vkey(circuit.name, proverKeyPath);
    expect(existsSync(vkeyPath)).to.be.true;
  });

  it('should export a verification key given a circuit name', async () => {
    const vkeyPath = await circomkit.vkey(circuit.name);
    expect(existsSync(vkeyPath)).to.be.true;
  });

  it('should throw when exporting a verification key given an invalid prover key path', async () => {
    try {
      await circomkit.vkey(circuit.name, 'non-existent-path');
    } catch (err) {
      expect((err as Error).message).to.eq(
        'There must be a prover key for this circuit to extract a verification key.'
      );
    }
  });

  it('should create an input', async () => {
    const path = circomkit.input(circuit.name, inputName, signals.input);
    expect(existsSync(path)).to.be.true;
  });

  it('should create a witness', async () => {
    const path = await circomkit.witness(circuit.name, inputName);
    expect(existsSync(path)).to.be.true;
  });

  it('should create a proof', async () => {
    const path = await circomkit.prove(circuit.name, inputName);
    expect(existsSync(path)).to.be.true;
  });

  it('should verify the proof', async () => {
    const isVerified = await circomkit.verify(circuit.name, inputName);
    expect(isVerified).to.be.true;
  });

  it('should export verifier contract', async () => {
    const path = await circomkit.contract(circuit.name);
    expect(existsSync(path)).to.be.true;
  });

  it('should export contract calldata', async () => {
    await circomkit.calldata(circuit.name, inputName);
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
      expect((err as Error).message).to.eq('Exporting zKey to JSON is only supported for Groth16 at the moment.');
    }
  });
});
