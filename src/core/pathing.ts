import type {CircomkitConfig} from '../configs';

/** Utility class to handle path abstractions.
 *
 * This class takes in a reference to the Circomkit configuration and provides the correct pathing.
 */
export class CircomkitPath {
  constructor(private readonly config: CircomkitConfig) {}

  /**
   * Computes a path that requires a circuit name.
   *
   * @param circuit The name of the circuit.
   * @param kind The kind of file to compute the path for.
   */
  ofCircuit(circuit: string, kind: 'main' | 'sym' | 'pkey' | 'vkey' | 'wasm' | 'sol' | 'dir' | 'r1cs'): string {
    const dir = `${this.config.dirBuild}/${circuit}`;
    switch (kind) {
      case 'dir':
        return dir;
      case 'main':
        return `${this.config.dirCircuits}/main/${circuit}.circom`;
      case 'r1cs':
        return `${dir}/${circuit}.r1cs`;
      case 'sym':
        return `${dir}/${circuit}.sym`;
      case 'wasm':
        return `${dir}/${circuit}_js/${circuit}.wasm`;
      case 'pkey':
        return `${dir}/${this.config.protocol}_pkey.zkey`;
      case 'vkey':
        return `${dir}/${this.config.protocol}_vkey.json`;
      case 'sol':
        return `${dir}/${this.config.protocol}_verifier.sol`;
      default:
        kind satisfies never;
        throw new Error('Invalid kind: ' + kind);
    }
  }

  /**
   * Computes a path that requires a circuit and an input name.
   *
   * @param circuit The name of the circuit.
   * @param input The name of the input.
   * @param kind The kind of file to compute the path for.
   */
  ofCircuitWithInput(circuit: string, input: string, kind: 'pubs' | 'proof' | 'wtns' | 'in' | 'dir'): string {
    const dir = `${this.config.dirBuild}/${circuit}/${input}`;
    switch (kind) {
      case 'dir':
        return dir;
      case 'wtns':
        return `${dir}/witness.wtns`;
      case 'pubs':
        return `${dir}/public.json`;
      case 'proof':
        return `${dir}/${this.config.protocol}_proof.json`;
      case 'in':
        return `${this.config.dirInputs}/${circuit}/${input}.json`;
      default:
        kind satisfies never;
        throw new Error('Invalid type: ' + kind);
    }
  }

  /**
   * Given a PTAU name, returns the relative path.
   *
   * @param ptauName The name of the PTAU file, e.g. `powersOfTau28_hez_final_08.ptau`.
   */
  ofPtau(ptauName: string): string {
    return `${this.config.dirPtau}/${ptauName}`;
  }

  /**
   * Given a circuit & id name, returns the relative path of the phase-2 PTAU.
   *
   * This is used in particular by Groth16's circuit-specific setup phase.
   *
   * @param circuit The name of the circuit.
   * @param id The id of the zKey.
   */
  ofZkey(circuit: string, id: number): string {
    return `${this.config.dirBuild}/${circuit}/${circuit}_${id}.zkey`;
  }
}
