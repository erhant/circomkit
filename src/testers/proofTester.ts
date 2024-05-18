import type {FflonkProof, Groth16Proof, PlonkProof, PublicSignals} from 'snarkjs';
import * as snarkjs from 'snarkjs';
import {readFileSync} from 'fs';
import type {CircuitSignals} from '../types/';
import type {CircomkitConfig} from '../configs';
import {AssertionError} from 'node:assert';

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
  async prove(input: CircuitSignals<IN>): Promise<{proof: Groth16Proof; publicSignals: PublicSignals}>;
  async prove(input: CircuitSignals<IN>): Promise<{proof: PlonkProof; publicSignals: PublicSignals}>;
  async prove(input: CircuitSignals<IN>): Promise<{proof: FflonkProof; publicSignals: PublicSignals}>;
  async prove(
    input: CircuitSignals<IN>
  ): Promise<
    | {proof: Groth16Proof; publicSignals: PublicSignals}
    | {proof: PlonkProof; publicSignals: PublicSignals}
    | {proof: FflonkProof; publicSignals: PublicSignals}
  > {
    return snarkjs[this.protocol].fullProve(input, this.wasmPath, this.pkeyPath, undefined);
  }

  /** Returns the verification result of a proof for some public signals. */
  async verify(proof: Groth16Proof, publicSignals: PublicSignals): Promise<boolean>;
  async verify(proof: PlonkProof, publicSignals: PublicSignals): Promise<boolean>;
  async verify(proof: FflonkProof, publicSignals: PublicSignals): Promise<boolean>;
  async verify(proof: Groth16Proof | PlonkProof | FflonkProof, publicSignals: PublicSignals): Promise<boolean> {
    return await snarkjs[this.protocol].verify(
      this.verificationKey,
      publicSignals,
      proof as Groth16Proof & PlonkProof & FflonkProof
    );
  }

  /** Expects a verification to pass for this proof and public signals. */
  async expectPass(proof: Groth16Proof, publicSignals: PublicSignals): Promise<void>;
  async expectPass(proof: PlonkProof, publicSignals: PublicSignals): Promise<void>;
  async expectPass(proof: FflonkProof, publicSignals: PublicSignals): Promise<void>;
  async expectPass(proof: Groth16Proof | PlonkProof | FflonkProof, publicSignals: PublicSignals): Promise<void> {
    const ok = await this.verify(proof as Groth16Proof & PlonkProof & FflonkProof, publicSignals);
    if (!ok) {
      throw new AssertionError({
        message: 'Expected proof to be verified.',
        expected: true,
        actual: false,
      });
    }
  }

  /** Expects a verification to fail for this proof and public signals. */
  async expectFail(proof: Groth16Proof, publicSignals: PublicSignals): Promise<void>;
  async expectFail(proof: PlonkProof, publicSignals: PublicSignals): Promise<void>;
  async expectFail(proof: FflonkProof, publicSignals: PublicSignals): Promise<void>;
  async expectFail(proof: Groth16Proof | PlonkProof | FflonkProof, publicSignals: PublicSignals): Promise<void> {
    const ok = await this.verify(proof as Groth16Proof & PlonkProof & FflonkProof, publicSignals);
    if (ok) {
      throw new AssertionError({
        message: 'Expected proof to be not verified.',
        expected: false,
        actual: true,
      });
    }
  }
}
