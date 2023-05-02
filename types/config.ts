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
