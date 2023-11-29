import forEach from 'mocha-each';
import {PROTOCOLS} from '../src/utils/config';
import {Circomkit} from '../src';
import {expect} from 'chai';
import {existsSync, rmSync} from 'fs';
import {CIRCUIT_CONFIG, CIRCUIT_NAME, INPUT, INPUT_NAME, PTAU_PATH} from './common';

// we are not testing all curves because PTAU is only available for bn128
forEach(PROTOCOLS).describe('protocol: %s', (protocol: (typeof PROTOCOLS)[number]) => {
  let circomkit: Circomkit;

  before(() => {
    circomkit = new Circomkit({
      protocol,
      verbose: false,
      logLevel: 'silent',
    });
  });

  it('should instantiate circuit', () => {
    const path = circomkit.instantiate(CIRCUIT_NAME, CIRCUIT_CONFIG);
    expect(existsSync(path)).to.be.true;
    rmSync(path); // remove it to see if compile command creates it too
  });

  it('should compile circuit', async () => {
    await circomkit.compile(CIRCUIT_NAME);
  });

  it('should export circuit information', async () => {
    await circomkit.info(CIRCUIT_NAME);
  });

  it('should setup circuit', async () => {
    const {proverKeyPath, verifierKeyPath} = await circomkit.setup(CIRCUIT_NAME, PTAU_PATH);
    expect(existsSync(proverKeyPath)).to.be.true;
    expect(existsSync(verifierKeyPath)).to.be.true;
  });

  it('should create an input', async () => {
    const path = circomkit.input(CIRCUIT_NAME, INPUT_NAME, INPUT);
    expect(existsSync(path)).to.be.true;
  });

  it('should create a witness', async () => {
    const path = await circomkit.witness(CIRCUIT_NAME, INPUT_NAME);
    expect(existsSync(path)).to.be.true;
  });

  it('should create a proof', async () => {
    const path = await circomkit.prove(CIRCUIT_NAME, INPUT_NAME);
    expect(existsSync(path)).to.be.true;
  });

  it('should verify the proof', async () => {
    const isVerified = await circomkit.verify(CIRCUIT_NAME, INPUT_NAME);
    expect(isVerified).to.be.true;
  });

  it('should export verifier contract', async () => {
    const path = await circomkit.contract(CIRCUIT_NAME);
    expect(existsSync(path)).to.be.true;
  });

  it('should export contract calldata', async () => {
    try {
      await circomkit.calldata(CIRCUIT_NAME, INPUT_NAME);

      // fflonk should fail for `calldata`
      if (protocol === 'fflonk') {
        throw new Error('Should have thrown an error before this.');
      }
    } catch (err) {
      expect((err as Error).message).to.eq('Exporting calldata is not supported for fflonk yet.');
    }
  });

  it('should export JSON files', async () => {
    await circomkit.json('r1cs', CIRCUIT_NAME);
    await circomkit.json('wtns', CIRCUIT_NAME, INPUT_NAME);

    try {
      await circomkit.json('zkey', CIRCUIT_NAME);

      // only groth16 is allowed to export zkey
      if (protocol !== 'groth16') {
        throw new Error('Should have thrown an error before this.');
      }
    } catch (err) {
      expect((err as Error).message).to.eq('Exporting zKey to JSON is only supported for Groth16 at the moment.');
    }
  });
});
