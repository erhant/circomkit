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
  /** Compiler options for Circom. */
  compiler: {
    /** Output constraints in JSON format. */
    json: boolean;
    /** Show Circom logs during compilation. */
    verbose: boolean;
    /**
     * Optimization level.
     * - `0`: No simplification is applied.
     * - `1`: Only applies `var` to `var` and `var` to `constant` simplification.
     */
    optimization: 0 | 1;
    /** Include paths as libraries during compilation. */
    include: string[];
  };
  /** Colors for the logs */
  colors: {
    title: ColorType; // blue
    log: ColorType; // gray
    error: ColorType; // red
  };
};

export const defaultConfig: Readonly<CircomkitConfig> = {
  proofSystem: 'plonk',
  curve: 'bn128',
  version: '2.1.0',
  silent: false,
  colors: {
    title: '\x1b[0;34m', // blue
    log: '\x1b[2;37m', // gray
    error: '\x1b[0;31m', // red
  },
  compiler: {
    optimization: 0,
    verbose: false,
    json: false,
    include: ['./node_modules'],
  },
};
