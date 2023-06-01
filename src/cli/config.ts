type ColorType = `\x1b[${number}m` | `\x1b[${number};${number}m`;
type VersionType = `${number}.${number}.${number}`;

export type CircomkitConfig = {
  /** Proof system to be used. */
  proofSystem: 'groth16' | 'plonk';
  /** Curve to be used, which defines the underlying prime field. */
  curve: 'bn128' | 'bls12381' | 'goldilocks';
  /** Version number for main components. */
  version: VersionType;
  /** Hide Circomkit logs */
  silent: boolean;
  /** Which files to output. */
  outputs: {
    /** Output R1CS file. */
    r1cs: boolean;
    /** Output symbol file. */
    sym: boolean;
    /** Output WASM circuit. */
    wasm: boolean;
    /** Output witness generator in C. */
    c: boolean;
    wat: boolean;
    json: boolean;
  };
  colors: {
    title: ColorType; // blue
    log: ColorType; // gray
    error: ColorType; // red
  };
  /** Do an additional check over the produced constraints. */
  inspect: boolean;
  /** Show Circom logs during compilation. */
  verbose: boolean;
  /**
   * Optimization level.
   * - `0`: No simplification is applied.
   * - `1`: Only applies `var` to `var` and `var` to `constant` simplification.
   * - `2`: Full constraint simplification.
   */
  optimization: 0 | 1 | 2;
  /** Libraries to be linked to search path. */
  libraries: string[];
};

export const defaultConfig: Readonly<CircomkitConfig> = {
  proofSystem: 'groth16',
  curve: 'bn128',
  version: '2.1.0',
  silent: false,
  outputs: {
    r1cs: true,
    sym: true,
    wasm: true,
    c: false,
    wat: false,
    json: false,
  },
  colors: {
    title: '\x1b[0;34m', // blue
    log: '\x1b[2;37m', // gray
    error: '\x1b[0;31m', // red
  },
  inspect: true,
  optimization: 0,
  verbose: false,
  libraries: ['./node_modules'],
};
