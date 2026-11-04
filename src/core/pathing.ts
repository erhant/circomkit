import {existsSync} from 'node:fs';
import type {CircomkitConfig} from '../configs';

/** Utility class to handle path abstractions.
 *
 * This class takes in a reference to the Circomkit configuration and provides the correct pathing.
 * Paths of a circuit are computed with that circuit's configuration, i.e. with its `overrides` applied.
 */
export class CircomkitPath {
  constructor(
    private readonly config: CircomkitConfig,
    /** Returns the configuration of a circuit, defaults to the global configuration. */
    private readonly resolve: (circuit: string) => CircomkitConfig = () => config,
    /** Returns the directory of a circuit's `main` component within `dirCircuits`, defaults to `main`. */
    private readonly mainDir: (circuit: string) => string = () => 'main'
  ) {}

  /**
   * Computes a path that requires a circuit name.
   *
   * @param circuit The name of the circuit.
   * @param kind The kind of file to compute the path for.
   */
  ofCircuit(circuit: string, kind: 'main' | 'sym' | 'pkey' | 'vkey' | 'wasm' | 'sol' | 'dir' | 'r1cs'): string {
    const config = this.resolve(circuit);
    const dir = `${config.dirBuild}/${circuit}`;
    switch (kind) {
      case 'dir':
        return dir;
      case 'main':
        return `${config.dirCircuits}/${this.mainDir(circuit)}/${circuit}.circom`;
      case 'r1cs':
        return `${dir}/${circuit}.r1cs`;
      case 'sym':
        return `${dir}/${circuit}.sym`;
      case 'wasm':
        return `${dir}/${circuit}_js/${circuit}.wasm`;
      case 'pkey':
        return `${dir}/${config.protocol}_pkey.zkey`;
      case 'vkey':
        return `${dir}/${config.protocol}_vkey.json`;
      case 'sol':
        return `${dir}/${config.protocol}_verifier.sol`;
      default:
        kind satisfies never;
        throw new Error(`Invalid kind: ${kind}`);
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
    const config = this.resolve(circuit);
    const dir = `${config.dirBuild}/${circuit}/${input}`;
    switch (kind) {
      case 'dir':
        return dir;
      case 'wtns':
        return `${dir}/witness.wtns`;
      case 'pubs':
        return `${dir}/public.json`;
      case 'proof':
        return `${dir}/${config.protocol}_proof.json`;
      case 'in': {
        const path = `${config.dirInputs}/${circuit}/${input}.json`;
        // the default input can also be `<dirInputs>/<circuit>.json`, for circuits with a single input
        const flat = `${config.dirInputs}/${circuit}.json`;
        return input === 'default' && !existsSync(path) && existsSync(flat) ? flat : path;
      }
      default:
        kind satisfies never;
        throw new Error(`Invalid type: ${kind}`);
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
    return `${this.resolve(circuit).dirBuild}/${circuit}/${circuit}_${id}.zkey`;
  }
}
