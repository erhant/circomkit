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

/**
 * A configuration object for circuit main components.
 */
export type CircuitConfig = {
  /**
   * File to read the template from
   */
  file: string;

  /**
   * The template name to instantiate
   */
  template: string;

  /**
   * An array of public input signal names
   */
  publicInputs: string[];

  /**
   * An array of template parameters
   */
  templateParams: (number | bigint)[];
};

/**
 * Configurations for your circuits.
 * @see `circuit.config.cjs` in the project root.
 */
export type Config = {
  [circuitName: string]: CircuitConfig;
};
