/**
 * Configuration file for your circuits.
 */
export type Config = {
  [circuitName: string]: {
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

    /**
     * Directory to output under `circuits`, defaults to `main`
     * @depracated work in progress, use `main` for now (leave empty)
     */
    dir?: string;
  };
};
