type IntegerValue = `${number}` | number | bigint;
type SignalValue = IntegerValue | SignalValue[];

/**
 * An object with string keys and array of numerical values.
 * Each key represents a signal name as it appears in the circuit.
 * By default, signal names are not typed, but you can pass an array of signal names
 * to make them type-safe, e.g. `CircuitSignals<['sig1', 'sig2']>`
 */
export type CircuitSignals<T extends string[] = []> = T extends []
  ? {[signal: string]: SignalValue}
  : {[signal in T[number]]: SignalValue};

/**
 * A witness is an array of bigints, corresponding to the values of each wire in
 * the evaluation of the circuit.
 */
export type WitnessType = bigint[];

/**
 * A FullProof, as returned from SnarkJS `fullProve` function.
 */
export type FullProof = {
  proof: object;
  publicSignals: string[];
};

/**
 * Proof system to be used
 */
export type ProofSystem = 'groth16' | 'plonk' | 'fflonk';
