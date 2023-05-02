const wasm_tester = require('circom_tester').wasm;
import {WitnessType, CircuitSignals} from '../types/circuit';
import {CircomWasmTester} from '../types/wasmTester';
import {assert, expect} from 'chai';

/**
 A utility class to test your circuits. Use `expectFailedAssert` and `expectCorrectAssert` to test out evaluations
 */
export class WasmTester<IN extends readonly string[] = [], OUT extends readonly string[] = []> {
  /**
   * The underlying `circom_tester` object
   */
  readonly circomWasmTester: CircomWasmTester;

  /**
   * A dictionary of symbols
   */
  symbols: object | undefined;

  /**
   * List of constraints, must call `loadConstraints` before accessing this key
   */
  constraints: any[] | undefined;

  constructor(circomWasmTester: CircomWasmTester) {
    this.circomWasmTester = circomWasmTester;
  }

  /**
   * Assert that constraints are valid.
   * @param witness witness
   */
  checkConstraints(witness: WitnessType): Promise<void> {
    return this.circomWasmTester.checkConstraints(witness);
  }

  /**
   * Assert the output of a given witness.
   * @param actualOut expected witness
   * @param expectedOut computed output signals
   */
  assertOut(actualOut: WitnessType, expectedOut: CircuitSignals<OUT>): Promise<void> {
    return this.circomWasmTester.assertOut(actualOut, expectedOut);
  }

  /**
   * Compute witness given the input signals.
   * @param input all signals, private and public.
   * @param sanityCheck check if input signals are sanitized
   */
  calculateWitness(input: CircuitSignals<IN>, sanityCheck: boolean): Promise<WitnessType> {
    return this.circomWasmTester.calculateWitness(input, sanityCheck);
  }

  /**
   * Loads the list of R1CS constraints to `this.constraints`
   */
  async loadConstraints(): Promise<void> {
    await this.circomWasmTester.loadConstraints();
    this.constraints = this.circomWasmTester.constraints;
  }

  /**
   * Loads the symbols in a dictionary at `this.symbols`
   * Symbols are stored under the .sym file
   * Each line has 4 comma-separated values:
   * 0: label index
   * 1: variable index
   * 2: component index
   */
  async loadSymbols(): Promise<void> {
    await this.circomWasmTester.loadSymbols();
    this.symbols = this.circomWasmTester.symbols;
  }

  /**
   * @deprecated this is buggy right now
   * @param witness witness
   */
  getDecoratedOutput(witness: WitnessType): Promise<string> {
    return this.circomWasmTester.getDecoratedOutput(witness);
  }

  /**
   * Cleanup directory, should probably be called upon test completion
   * @deprecated this is buggy right now
   */
  release(): Promise<void> {
    return this.circomWasmTester.release();
  }

  //////// CUSTOM ADDITIONS /////////

  /**
   * Prints the number of constraints of the circuit.
   * If expected count is provided, will also include that in the log.
   * @param circuit WasmTester circuit
   * @param expected expected number of constraints
   */
  async printConstraintCount(expected?: number) {
    // load constraints
    if (this.constraints === undefined) {
      await this.loadConstraints();
    }
    const numConstraints = this.constraints!.length;

    // if expecting a specific number, check if you match that
    let expectionMessage = '';
    if (expected !== undefined) {
      let alertType = '';
      if (numConstraints < expected) {
        alertType = '🔴'; // need more
      } else if (numConstraints > expected) {
        alertType = '🟡'; // too many
      } else {
        alertType = '🟢'; // on point
      }
      expectionMessage = ` (${alertType} expected ${expected})`;
    }
    console.log(`#constraints: ${numConstraints}` + expectionMessage);
  }

  /**
   * Expect an input to fail an assertion in the circuit.
   * @param input bad input
   */
  async expectFailedAssert(input: CircuitSignals<IN>) {
    await this.calculateWitness(input, true).then(
      () => assert.fail(),
      err => expect(err.message.slice(0, 21)).to.eq('Error: Assert Failed.')
    );
  }

  /**
   * Expect an input to pass assertions and match the output.
   * @param input correct input
   * @param output expected output, if `undefined` it will only check constraints
   */
  async expectCorrectAssert(input: CircuitSignals<IN>, output?: CircuitSignals<OUT>) {
    const witness = await this.calculateWitness(input, true);
    await this.checkConstraints(witness);
    if (output) {
      await this.assertOut(witness, output);
    }
  }
}

/**
 * Compiles and reutrns a circuit tester class instance.
 * @param circuit name of circuit
 * @param dir directory to read the circuit from, defaults to `main`
 * @returns a `WasmTester` instance
 */
export async function createWasmTester<IN extends string[] = [], OUT extends string[] = []>(
  circuitName: string,
  dir = 'main'
): Promise<WasmTester<IN, OUT>> {
  const circomWasmTester: CircomWasmTester = await wasm_tester(`./circuits/${dir}/${circuitName}.circom`, {
    include: 'node_modules', // will link circomlib circuits
  });
  return new WasmTester<IN, OUT>(circomWasmTester);
}
