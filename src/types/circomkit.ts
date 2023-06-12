type ColorType = `\x1b[${number}m` | `\x1b[${number};${number}m`;
type VersionType = `${number}.${number}.${number}`;

export type CircomkitConfig = {
  /** Proof system to be used. */
  proofSystem: 'groth16' | 'plonk' | 'fflonk';
  /** Curve to be used, which defines the underlying prime field. */
  curve: 'bn128' | 'bls12381' | 'goldilocks';
  /** Directory overrides, it is best you leave this as is. */
  dirs: {
    /** Directory to read circuits from. */
    circuits: string;
    /** Folder name to output the main component under `circuits` directory. */
    main: string;
    /** Directory to read inputs from. */
    inputs: string;
    /** Directory to download PTAU files. */
    ptau: string;
    /** Directory to output circuit build files. */
    build: string;
  };
  /** Groth16-specific configurations */
  groth16: {
    /** Number of contributions */
    numContributions: number;
    /** Ask user input to create entropy */
    askForEntropy: boolean;
  };
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
    warn: ColorType;
  };
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
