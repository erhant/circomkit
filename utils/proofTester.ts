import fs from 'fs';
const snarkjs = require('snarkjs');
import {expect} from 'chai';
import type {CircuitSignals, FullProof, ProofSystem} from '../types/circuit';

const PROOF_SYSTEMS = ['groth16', 'plonk', 'fflonk'] as const;

/**
 * A more extensive Circuit class, able to generate proofs & verify them.
 * Assumes that prover key and verifier key have been computed.
 */
export class ProofTester<IN extends string[] = []> {
  public readonly protocol: (typeof PROOF_SYSTEMS)[number];
  private readonly wasmPath: string;
  private readonly proverKeyPath: string;
  private readonly verificationKeyPath: string;
  private readonly verificationKey: object & {
    protocol: ProofSystem;
  };

  /**
   * Sets the paths & loads the verification key. The underlying proof system is checked by looking
   * at `verificationKey.protocol`.
   * @param circuit a proof tester
   */
  constructor(circuit: string) {
    // find paths (computed w.r.t circuit name)
    this.wasmPath = `./build/${circuit}/${circuit}_js/${circuit}.wasm`;
    this.proverKeyPath = `./build/${circuit}/prover_key.zkey`;
    this.verificationKeyPath = `./build/${circuit}/verification_key.json`;

    // ensure that paths exist
    const missing = [this.wasmPath, this.proverKeyPath, this.verificationKeyPath].filter(p => !fs.existsSync(p));
    if (missing.length !== 0) {
      throw new Error('Missing files for' + circuit + ':\n' + missing.join('\n'));
    }

    // load verification key
    this.verificationKey = JSON.parse(
      fs.readFileSync(this.verificationKeyPath).toString()
    ) as typeof this.verificationKey;

    // check proof system
    if (!PROOF_SYSTEMS.includes(this.verificationKey.protocol)) {
      throw new Error('Unknown protocol in verification key: ' + this.verificationKey.protocol);
    }
    this.protocol = this.verificationKey.protocol;
  }

  /**
   * Generate a proof for the witness computed from the given input signals.
   * Calls `fullProve` behind the scenes.
   * @param input input signals for the circuit
   * @returns a proof and public signals
   */
  async prove(input: CircuitSignals<IN>): Promise<FullProof> {
    return await snarkjs[this.protocol].fullProve(input, this.wasmPath, this.proverKeyPath);
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
