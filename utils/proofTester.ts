import fs from 'fs';
const snarkjs = require('snarkjs');
import {expect} from 'chai';
import type {CircuitSignals, FullProof, ProofSystem} from '../types/circuit';

/**
 * A more extensive Circuit class, able to generate proofs & verify them.
 * Assumes that prover key and verifier key have been computed.
 */
export class ProofTester {
  public readonly proofSystem: ProofSystem;
  private readonly wasmPath: string;
  private readonly proverKeyPath: string;
  private readonly verificationKey: object;

  /**
   * Sets the paths & loads the verification key
   * @param circuit a proof tester
   * @param proofSystem proof system to use, defaults to `groth16`
   */
  constructor(circuit: string, proofSystem: ProofSystem = 'groth16') {
    // find paths (computed w.r.t circuit name)
    this.wasmPath = `./build/${circuit}/${circuit}_js/${circuit}.wasm`;
    this.proverKeyPath = `./build/${circuit}/prover_key.zkey`;
    const verificationKeyPath = `./build/${circuit}/verification_key.json`;

    // ensure that paths exist
    const missing = [this.wasmPath, this.proverKeyPath, verificationKeyPath].filter(p => !fs.existsSync(p));
    if (missing.length !== 0) {
      throw new Error('Missing files for' + circuit + '\n' + missing);
    }

    // load verification key
    this.verificationKey = JSON.parse(fs.readFileSync(verificationKeyPath).toString());

    // set proof system
    this.proofSystem = proofSystem;
  }

  /**
   * Generate a proof for the witness computed from the given input signals.
   * Calls `fullProve` behind the scenes.
   * @param input input signals for the circuit
   * @returns a proof and public signals
   */
  async prove(input: CircuitSignals): Promise<FullProof> {
    return await snarkjs[this.proofSystem].fullProve(input, this.wasmPath, this.proverKeyPath);
  }

  /**
   * Verify a proof for some public signals.
   * @param proof proof object, given from `prove`
   * @param publicSignals public signals for the circuit
   * @returns `true` if proof verifies, `false` otherwise
   */
  async verify(proof: object, publicSignals: string[]): Promise<boolean> {
    return await snarkjs[this.proofSystem].verify(this.verificationKey, publicSignals, proof);
  }

  /**
   * Verification should pass for this proof and public signals.
   * @param proof proof object, given from `prove`
   * @param publicSignals public signals for the circuit
   */
  async expectVerificationPass(proof: object, publicSignals: string[]): Promise<void> {
    expect(await this.verify(proof, publicSignals)).to.be.true;
  }

  /**
   * Verification should fail for this proof and public signals.
   * @param proof proof object, given from `prove`
   * @param publicSignals public signals for the circuit
   */
  async expectVerificationFail(proof: object, publicSignals: string[]): Promise<void> {
    expect(await this.verify(proof, publicSignals)).to.be.false;
  }
}
