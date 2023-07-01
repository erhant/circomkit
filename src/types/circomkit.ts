import type {LogLevelDesc} from 'loglevel';

export type CircomkitConfig = {
  /** Protocol to be used. */
  protocol: 'groth16' | 'plonk' | 'fflonk';
  /** Underlying prime field. */
  prime: 'bn128' | 'bls12381' | 'goldilocks';
  /** Circuit configurations path. */
  circuits: string;
  /** Directory to read circuits from. */
  dirCircuits: string;
  /** Directory to read inputs from. */
  dirInputs: string;
  /** Directory to download PTAU files. */
  dirPtau: string;
  /** Directory to output circuit build files. */
  dirBuild: string;
  /** Number of contributions */
  groth16numContributions: number;
  /** Ask user input to create entropy */
  groth16askForEntropy: boolean;
  /** Version number for main components. */
  version: `${number}.${number}.${number}`;
  /**
   * Optimization level.
   * - `0`: No simplification is applied.
   * - `1`: Only applies `var` to `var` and `var` to `constant` simplification.
   */
  optimization: 0 | 1;
  /** Include paths as libraries during compilation. */
  include: string[];
  /** Pass logger to SnarkJS to see its logs in addition to Circomkit */
  verbose: boolean;
  /** Log level used by the internal logger */
  logLevel: LogLevelDesc;
};

/** Shorthand notations for which path to build in Circomkit. These paths require a circuit name. */
export type CircuitPathBuilders = 'target' | 'sym' | 'pkey' | 'vkey' | 'wasm' | 'sol' | 'dir' | 'r1cs';

/** Shorthand notations for which path to build in Circomkit. These paths require a circuit name and input name. */
export type CircuitInputPathBuilders = 'pubs' | 'proof' | 'wtns' | 'in' | 'dir';

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object | undefined
    ? RecursivePartial<T[P]>
    : T[P];
};
export type CircomkitConfigOverrides = RecursivePartial<CircomkitConfig>;
