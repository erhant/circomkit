/** An integer value is a numerical string, a number, or a bigint. */
export type IntegerValueType = `${number}` | number | bigint;

/** A signal value is a number, or an array of numbers (recursively). */
export type SignalValueType = IntegerValueType | SignalValueType[];

/**
 * An object with string keys and array of numerical values.
 * Each key represents a signal name as it appears in the circuit.
 *
 * By default, signal names are not typed, but you can pass an array of signal names
 * to make them type-safe, e.g. `CircuitSignals<['sig1', 'sig2']>`
 */
export type CircuitSignals<T extends readonly string[] = []> = T extends []
  ? {[signal: string]: SignalValueType}
  : {[signal in T[number]]: SignalValueType};

/** A witness is an array of `bigint`s, corresponding to the values of each wire in the evaluation of the circuit. */
export type WitnessType = bigint[];

/**
 * Symbols are a mapping of each circuit `wire` to an object with three keys. Within them,
 * the most important is `varIdx` which indicates the position of this signal in the witness array.
 */
export type SymbolsType = {
  [symbol: string]: {
    labelIdx: number;
    varIdx: number;
    componentIdx: number;
  };
};

/** A configuration object for circuit main components. */
export type CircuitConfig = {
  /** File to read the template from */
  file: string;
  /** The template name to instantiate */
  template: string;
  /** Directory to instantiate at */
  dir?: string;
  /** Target version */
  version?: `${number}.${number}.${number}`;
  /** An array of public input signal names, defaults to `[]` */
  pubs?: string[];
  /** An array of template parameters, defaults to `[]` */
  params?: (number | bigint)[];
};

/** Some fields for the R1CS information returned by SnarkJS.
 * Many other fields are omitted in this type.
 */
export type R1CSInfoType = {
  variables: number;
  constraints: number;
  privateInputs: number;
  publicInputs: number;
  useCustomGates: boolean;
  labels: number;
  outputs: number;
  prime: bigint;
  primeName: string;
};
