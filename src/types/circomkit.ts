type ColorType = `\x1b[${number}m` | `\x1b[${number};${number}m`;
type VersionType = `${number}.${number}.${number}`;

export type CircomkitConfig = {
  /** Proof system to be used. */
  proofSystem: 'groth16' | 'plonk' | 'fflonk';
  /** Curve to be used, which defines the underlying prime field. */
  curve: 'bn128' | 'bls12381' | 'goldilocks';
  /** Directory to download PTAU files. */
  ptauDir: string;
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
    title: ColorType;
    success: ColorType;
    log: ColorType;
    error: ColorType;
  };
};

/** Shorthand notations for which path to build in Circomkit. These paths require a circuit name. */
export type CircuitPathBuilders = 'target' | 'sym' | 'pkey' | 'vkey' | 'wasm' | 'sol' | 'dir' | 'r1cs';

/** Shorthand notations for which path to build in Circomkit. These paths require a circuit name and input name. */
export type CircuitInputPathBuilders = 'pubs' | 'proof' | 'wtns' | 'in' | 'dir';
