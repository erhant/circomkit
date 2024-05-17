import * as snarkjs from 'snarkjs';
import {expect} from 'chai';
import {readFileSync} from 'fs';
import type {CircuitSignals, CircomkitConfig} from '../types/';

/** A tester that is able to generate proofs & verify them.
 * Use `expectFail` and `expectPass` to test out evaluations. */
export class ProofTester<IN extends string[] = [], P extends CircomkitConfig['protocol'] = 'groth16'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly verificationKey: any;

  constructor(
    readonly wasmPath: string,
    readonly pkeyPath: string,
    readonly vkeyPath: string,
    readonly protocol: P
  ) {
    this.verificationKey = JSON.parse(readFileSync(vkeyPath).toString()) as typeof this.verificationKey;
    if (this.verificationKey.protocol !== protocol) {
      throw new Error('Protocol mismatch.');
    }
  }

  /** Generate a proof for the witness computed from the given input signals. */
  async prove(input: CircuitSignals<IN>): Promise<{proof: snarkjs.Groth16Proof; publicSignals: snarkjs.PublicSignals}>;
  async prove(input: CircuitSignals<IN>): Promise<{proof: snarkjs.PlonkProof; publicSignals: snarkjs.PublicSignals}>;
  async prove(input: CircuitSignals<IN>): Promise<{proof: snarkjs.FflonkProof; publicSignals: snarkjs.PublicSignals}>;
  async prove(
    input: CircuitSignals<IN>
  ): Promise<
    | {proof: snarkjs.Groth16Proof; publicSignals: snarkjs.PublicSignals}
    | {proof: snarkjs.PlonkProof; publicSignals: snarkjs.PublicSignals}
    | {proof: snarkjs.FflonkProof; publicSignals: snarkjs.PublicSignals}
  > {
    return snarkjs[this.protocol].fullProve(input, this.wasmPath, this.pkeyPath, undefined);
  }

  /** Returns the verification result of a proof for some public signals. */
  async verify(proof: snarkjs.Groth16Proof, publicSignals: snarkjs.PublicSignals): Promise<boolean>;
  async verify(proof: snarkjs.PlonkProof, publicSignals: snarkjs.PublicSignals): Promise<boolean>;
  async verify(proof: snarkjs.FflonkProof, publicSignals: snarkjs.PublicSignals): Promise<boolean>;
  async verify(
    proof: snarkjs.Groth16Proof | snarkjs.PlonkProof | snarkjs.FflonkProof,
    publicSignals: string[]
  ): Promise<boolean> {
    return await snarkjs[this.protocol].verify(
      this.verificationKey,
      publicSignals,
      proof as snarkjs.Groth16Proof & snarkjs.PlonkProof & snarkjs.FflonkProof
    );
  }

  /** Expects a verification to pass for this proof and public signals. */
  async expectPass(proof: snarkjs.Groth16Proof, publicSignals: snarkjs.PublicSignals): Promise<void>;
  async expectPass(proof: snarkjs.PlonkProof, publicSignals: snarkjs.PublicSignals): Promise<void>;
  async expectPass(proof: snarkjs.FflonkProof, publicSignals: snarkjs.PublicSignals): Promise<void>;
  async expectPass(
    proof: snarkjs.Groth16Proof | snarkjs.PlonkProof | snarkjs.FflonkProof,
    publicSignals: snarkjs.PublicSignals
  ): Promise<void> {
    expect(
      await this.verify(proof as snarkjs.Groth16Proof & snarkjs.PlonkProof & snarkjs.FflonkProof, publicSignals),
      'Expected proof to be verified.'
    ).to.be.true;
  }

  /** Expects a verification to fail for this proof and public signals. */
  async expectFail(proof: snarkjs.Groth16Proof, publicSignals: snarkjs.PublicSignals): Promise<void>;
  async expectFail(proof: snarkjs.PlonkProof, publicSignals: snarkjs.PublicSignals): Promise<void>;
  async expectFail(proof: snarkjs.FflonkProof, publicSignals: snarkjs.PublicSignals): Promise<void>;
  async expectFail(
    proof: snarkjs.Groth16Proof | snarkjs.PlonkProof | snarkjs.FflonkProof,
    publicSignals: snarkjs.PublicSignals
  ): Promise<void> {
    expect(
      await this.verify(proof as snarkjs.Groth16Proof & snarkjs.PlonkProof & snarkjs.FflonkProof, publicSignals),
      'Expected proof to be not verified.'
    ).to.be.false;
  }
}
