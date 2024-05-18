import type {LogLevelDesc} from 'loglevel';

export const PROTOCOLS = ['groth16', 'plonk', 'fflonk'] as const;
export const PRIMES = ['bn128', 'bls12381', 'goldilocks', 'grumpkin', 'pallas', 'vesta', 'secq256r1'] as const;

export type CircomkitConfig = {
  /** Protocol (proof system) to be used. */
  protocol: (typeof PROTOCOLS)[number];
  /**
   * Primes supported by Circom, as described for the `-p` option.
   * @see https://github.com/iden3/circom/blob/master/program_structure/src/utils/constants.rs
   */
  prime: (typeof PRIMES)[number];
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
  /** Path to circom executable */
  circomPath: string;
  /** Number of contributions */
  groth16numContributions: number;
  /** Ask user input to create entropy */
  groth16askForEntropy: boolean;
  /** Version number for main components. */
  version: `${number}.${number}.${number}`;
  /**
   * [Optimization level](https://docs.circom.io/getting-started/compilation-options/#flags-and-options-related-to-the-r1cs-optimization).
   * - `0`: No simplification is applied.
   * - `1`: Only applies `var` to `var` and `var` to `constant` simplification.
   * - `2`: Full constraint simplificiation via Gaussian eliminations.
   * - `>2`: Any number higher than 2 will use `--O2round` with the number as simplification rounds.
   */
  optimization: number;
  /** Does an additional check over the constraints produced. */
  inspect: boolean;
  /** Include paths as libraries during compilation. */
  include: string[];
  /** Pass logger to SnarkJS to see its logs in addition to Circomkit. */
  verbose: boolean;
  /** Log level used by the internal logger. */
  logLevel: LogLevelDesc;
  /** Whether to generate the C witness calculator. */
  cWitness: boolean;
  /** Whether to print Solidity copy-pasteable calldata. */
  prettyCalldata: false;
};

/** Default configurations */
export const DEFAULT = Object.seal<Readonly<CircomkitConfig>>({
  // general settings
  protocol: 'groth16',
  prime: 'bn128',
  version: '2.1.0',
  // directories & paths
  circuits: './circuits.json',
  dirPtau: './ptau',
  dirCircuits: './circuits',
  dirInputs: './inputs',
  dirBuild: './build',
  circomPath: 'circom',
  // compiler-specific
  optimization: 1,
  inspect: true,
  include: ['./node_modules'],
  cWitness: false,
  // groth16 phase-2 settings
  groth16numContributions: 1,
  groth16askForEntropy: false,
  // solidity & calldata
  prettyCalldata: false,
  // logger
  logLevel: 'INFO',
  verbose: true,
});
