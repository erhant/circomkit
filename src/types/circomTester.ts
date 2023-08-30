import type {WitnessType, CircuitSignals, SymbolsType} from './circuit';

/**
 * A simple type-wrapper for `circom_tester` WASM tester class.
 * Not all functions may exist here, some are omitted.
 * @see https://github.com/iden3/circom_tester/blob/main/wasm/tester.js
 */
export type CircomWasmTester = {
  checkConstraints: (witness: WitnessType) => Promise<void>;
  release: () => Promise<void>;
  assertOut: (actualOut: WitnessType, expectedOut: CircuitSignals) => Promise<void>;
  calculateWitness: (input: CircuitSignals, sanityCheck: boolean) => Promise<WitnessType>;
  loadConstraints: () => Promise<void>;
  constraints: unknown[] | undefined;
  loadSymbols: () => Promise<void>;
  symbols: SymbolsType | undefined;
  getDecoratedOutput: (witness: WitnessType) => Promise<string>;
};
