/**
 * A json object with string keys.
 * Each key represents a signal name as it appears in the circuit
 */
export type CircuitSignals = {[signalName: string]: any};

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
