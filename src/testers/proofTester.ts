const snarkjs = require('snarkjs');
import {expect} from 'chai';
import {readFileSync} from 'fs';
import type {CircuitSignals} from '../types/circuit';
import type {CircomkitConfig} from '../types/circomkit';

/** A tester that is able to generate proofs & verify them.
 * Use `expectFail` and `expectPass` to test out evaluations. */
export default class ProofTester<IN extends string[] = []> {
  public readonly protocol: CircomkitConfig['protocol'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly verificationKey: any;

  constructor(readonly wasmPath: string, readonly pkeyPath: string, readonly vkeyPath: string) {
    this.verificationKey = JSON.parse(readFileSync(vkeyPath).toString()) as typeof this.verificationKey;
    this.protocol = this.verificationKey.protocol;
  }

  /**
   * Generate a proof for the witness computed from the given input signals.
   * Calls `fullProve` behind the scenes.
   * @param input input signals for the circuit
   * @returns a proof and public signals
   */
  async prove(input: CircuitSignals<IN>): Promise<{
    proof: object;
    publicSignals: string[];
  }> {
    return await snarkjs[this.protocol].fullProve(input, this.wasmPath, this.pkeyPath);
  }

  /**
   * Verify a proof for some public signals.
   * @param proof proof object, given from `prove`
   * @param publicSignals public signals for the circuit
   * @returns `true` if proof verifies, `false` otherwise
   */
  async verify(proof: object, publicSignals: string[]): Promise<boolean> {
    return await snarkjs[this.protocol].verify(this.verificationKey, publicSignals, proof);
  }

  /**
   * Verification should pass for this proof and public signals.
   * @param proof proof object, given from `prove`
   * @param publicSignals public signals for the circuit
   */
  async expectPass(proof: object, publicSignals: string[]): Promise<void> {
    expect(await this.verify(proof, publicSignals), 'Expected proof to be verified.').to.be.true;
  }

  /**
   * Verification should fail for this proof and public signals.
   * @param proof proof object, given from `prove`
   * @param publicSignals public signals for the circuit
   */
  async expectFail(proof: object, publicSignals: string[]): Promise<void> {
    expect(await this.verify(proof, publicSignals), 'Expected proof to be not verified.').to.be.false;
  }
}
