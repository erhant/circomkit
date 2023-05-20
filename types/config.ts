/**
 * A configuration object for circuit main components.
 */
export type CircuitConfig = {
  /** File to read the template from */
  file: string;
  /** The template name to instantiate */
  template: string;
  /** Directory to read the file, defaults to `test` */
  dir?: string;
  /** An array of public input signal names, defaults to `[]` */
  pubs?: string[];
  /** An array of template parameters, defaults to `[]` */
  params?: (number | bigint)[];
};

/**
 * Configurations for your main circuits.
 * @see `circuit.config.cjs` in the project root.
 */
export type Config = {
  [circuitName: string]: Omit<CircuitConfig, 'dir'>;
};
