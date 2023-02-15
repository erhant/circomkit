import {WitnessType, CircuitSignals} from './circuit';

/**
 * Custom types added with respect to `circomlibjs.wasm`. Not all functions exist here, some are omitted.
 * @see https://github.com/iden3/circom_tester/blob/main/wasm/tester.js
 */
export type WasmTester = {
  /**
   * Assert that constraints are valid.
   * @param witness
   */
  checkConstraints: (witness: WitnessType) => Promise<void>;

  /**
   * Assert the output of a given witness.
   * @param actualOut expected output signals
   * @param expectedOut computed output signals
   */
  assertOut: (actualOut: CircuitSignals, expectedOut: CircuitSignals) => Promise<void>;

  /**
   * Compute witness given the input signals.
   * @param input all signals, private and public.
   * @param sanityCheck ?
   */
  calculateWitness: (input: CircuitSignals, sanityCheck: boolean) => Promise<WitnessType>;
};
