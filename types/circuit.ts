/**
 * A json object with string keys.
 * Each key represents a signal name as it appears in the circuit
 */
export type CircuitSignals = {[signalName: string]: any};

/**
 * A witness is just an array of bigints.
 */
export type WitnessType = bigint[];

/**
 * A FullProof, as returned from SnarkJS `fullProve` function.
 */
export type FullProof = {
  proof: object;
  publicSignals: CircuitSignals;
};
