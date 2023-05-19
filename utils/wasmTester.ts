const wasm_tester = require('circom_tester').wasm;
import {WitnessType, CircuitSignals, SymbolsType, SignalValueType} from '../types/circuit';
import {CircomWasmTester} from '../types/wasmTester';
import {assert, expect} from 'chai';

/**
 A utility class to test your circuits. Use `expectFailedAssert` and `expectCorrectAssert` to test out evaluations
 */
export default class WasmTester<IN extends readonly string[] = [], OUT extends readonly string[] = []> {
  /**
   * The underlying `circom_tester` object
   */
  readonly circomWasmTester: CircomWasmTester;

  /**
   * A dictionary of symbols
   */
  symbols: SymbolsType | undefined;

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
   *
   * Each line has 4 comma-separated values:
   *
   * 1.  symbol name
   * 2.  label index
   * 3.  variable index
   * 4.  component index
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
  async checkConstraintCount(expected?: number) {
    // load constraints
    if (this.constraints === undefined) {
      await this.loadConstraints();
    }
    const numConstraints = this.constraints!.length;
    console.log(`#constraints: ${numConstraints}`);

    if (expected !== undefined) {
      if (numConstraints < expected) {
        console.log(`\x1b[0;31mx expectation ${expected}\x1b[0m`);
      } else if (numConstraints > expected) {
        console.log(`\x1b[0;33m! expectation ${expected}\x1b[0m`);
      } else {
        console.log(`\x1b[0;32m✔\x1b[2;37m expectation ${expected}\x1b[0m`);
      }
    }
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

  /**
   * @param input input signals
   * @param outputSignals an array of signal names
   */
  async parseOutput(
    input: CircuitSignals<IN>,
    ...outputSignals: OUT[number][]
  ): Promise<Partial<CircuitSignals<typeof outputSignals>>> {
    const witness = await this.calculateWitness(input, true);

    // get symbols of main component
    await this.loadSymbols();
    const symbolNames = Object.keys(this.symbols!).filter(signal => !signal.includes('.', 5)); // non-main signals have an additional `.` in them after `main.symbol`

    // for each out signal, process the respective symbol
    const entries: [OUT[number], SignalValueType][] = [];
    console.log('SYMBOL NAMES:', this.symbols);

    for (const outSignal of outputSignals) {
      // get the symbol values from symbol names
      const symbols = symbolNames.filter(s => s.startsWith(outSignal, 5));
      console.log('SYMBOLS:', symbols);

      // we can assume that a symbol with this name appears only once in `main`, and that the depth is same for
      // all occurences of this symbol, given the type system used in Circom. So, we can just count the number
      // of `[`s in the first symbol of this signal to find the number of dimensions of this signal.
      const splits = symbols.at(-1)!.split('[');
      const depth = splits.length - 1;
      const startIdx = this.symbols![symbols[0]].varIdx;

      if (depth === 0) {
        // easy case, just return the witness of this symbol
        entries.push([outSignal, witness[startIdx]]);
      } else {
        const dims = splits.slice(1).map(dim => parseInt(dim.slice(0, -1)));

        // TODO

        entries.push([outSignal, 0]); // TODO
      }
    }

    // TODO: find better typing
    return Object.fromEntries(entries) as CircuitSignals<typeof outputSignals>;
  }

  /**
   * Compiles and reutrns a circuit tester class instance.
   * @param circuit name of circuit
   * @param dir directory to read the circuit from, defaults to `test`
   * @returns a `WasmTester` instance
   */
  static async new<IN extends string[] = [], OUT extends string[] = []>(
    circuitName: string,
    dir = 'test'
  ): Promise<WasmTester<IN, OUT>> {
    const circomWasmTester: CircomWasmTester = await wasm_tester(`./circuits/${dir}/${circuitName}.circom`, {
      include: 'node_modules', // will link circomlib circuits
    });
    return new WasmTester<IN, OUT>(circomWasmTester);
  }
}
