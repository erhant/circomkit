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

  constructor(
    readonly wasmPath: string,
    readonly pkeyPath: string,
    readonly vkeyPath: string
  ) {
    this.verificationKey = JSON.parse(readFileSync(vkeyPath).toString()) as typeof this.verificationKey;
    this.protocol = this.verificationKey.protocol;
  }

  /** Generate a proof for the witness computed from the given input signals. */
  async prove(input: CircuitSignals<IN>): Promise<{
    proof: object;
    publicSignals: string[];
  }> {
    return await snarkjs[this.protocol].fullProve(input, this.wasmPath, this.pkeyPath);
  }

  /** Returns the verification result of a proof for some public signals. */
  async verify(proof: object, publicSignals: string[]): Promise<boolean> {
    return await snarkjs[this.protocol].verify(this.verificationKey, publicSignals, proof);
  }

  /** Expects a verification to pass for this proof and public signals. */
  async expectPass(proof: object, publicSignals: string[]): Promise<void> {
    expect(await this.verify(proof, publicSignals), 'Expected proof to be verified.').to.be.true;
  }

  /** Expects a verification to fail for this proof and public signals. */
  async expectFail(proof: object, publicSignals: string[]): Promise<void> {
    expect(await this.verify(proof, publicSignals), 'Expected proof to be not verified.').to.be.false;
  }
}
