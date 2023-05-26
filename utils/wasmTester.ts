const wasm_tester = require('circom_tester').wasm;
import {WitnessType, CircuitSignals, SymbolsType, SignalValueType} from '../types/circuit';
import {CircuitConfig} from '../types/config';
import {CircomWasmTester} from '../types/wasmTester';
import {assert, expect} from 'chai';
import instantiate from '../utils/instantiate';

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
   * Assert that constraints are valid for a given witness.
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
    console.log(`# constraints: ${numConstraints}`);

    if (expected !== undefined) {
      if (numConstraints < expected) {
        console.log(`\x1b[0;31mx expectation: ${expected}\x1b[0m`);
      } else if (numConstraints > expected) {
        console.log(`\x1b[0;33m! expectation: ${expected}\x1b[0m`);
      } else {
        console.log(`\x1b[0;32m✔\x1b[2;37m expectation: ${expected}\x1b[0m`);
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
   * Computes the output.
   *
   * This is an **expensive operation** in the following sense:
   *
   * 1. the witness is calculated via `calculateWitness`
   * 2. symbols are loaded via `loadSymbols`, which is a bit expensive in it's own sense
   * 3. for the requested output signals, the symbols are parsed and the required symbols are retrieved
   * 4. for each signal & it's required symbols, corresponding witness values are retrieved from witness
   * 5. the results are aggregated in a final object, of the same type of circuit output signals
   *
   * @param input input signals
   * @param outputSignals an array of signal names
   * @returns output signals
   */
  async compute(input: CircuitSignals<IN>, outputSignals: OUT): Promise<CircuitSignals<typeof outputSignals>> {
    // compute witness & check constraints
    const witness = await this.calculateWitness(input, true);
    await this.checkConstraints(witness);

    // get symbols of main component
    await this.loadSymbols();
    const symbolNames = Object.keys(this.symbols!).filter(signal => !signal.includes('.', 5)); // non-main signals have an additional `.` in them after `main.symbol`

    // for each out signal, process the respective symbol
    const entries: [OUT[number], SignalValueType][] = [];

    for (const outSignal of outputSignals) {
      // get the symbol values from symbol names
      const symbols = symbolNames.filter(s => s.startsWith(outSignal, 5));

      /*
      we can assume that a symbol with this name appears only once in `main`, and that the depth is same for
      all occurences of this symbol, given the type system used in Circom. So, we can just count the number
      of `[`s in any symbol of this signal to find the number of dimensions of this signal.
      we particularly choose the last symbol in the array, as that holds the maximum index of each dimension of this array.
      */
      const splits = symbols.at(-1)!.split('[');

      // since we chose the last symbol, we have something like `main.signal[dim1][dim2]...[dimN]` which we can parse
      const dims = splits.slice(1).map(dim => parseInt(dim.slice(0, -1)) + 1); // +1 is needed because the final value is 0-indexed

      // since signal names are consequent, we only need to know the witness index of the first symbol
      let idx = this.symbols![symbols[0]].varIdx;

      if (dims.length === 0) {
        // easy case, just return the witness of this symbol
        entries.push([outSignal, witness[idx]]);
      } else {
        /*
        at this point, we have an array of signals like `main.signal[0..dim1][0..dim2]..[0..dimN]` and we must construct
        the necessary multi-dimensional array out of it.
        */
        // eslint-disable-next-line no-inner-declarations
        function processDepth(d: number): SignalValueType {
          const acc: SignalValueType = [];
          if (d === dims.length - 1) {
            // final depth, count witnesses
            for (let i = 0; i < dims[d]; i++) {
              acc.push(witness[idx++]);
            }
          } else {
            // not final depth, recurse to next
            for (let i = 0; i < dims[d]; i++) {
              acc.push(processDepth(d + 1));
            }
          }
          return acc;
        }
        entries.push([outSignal, processDepth(0)]);
      }
    }

    return Object.fromEntries(entries) as CircuitSignals<OUT>;
  }

  /**
   * Override witness value to try and fake a proof. If the circuit has soundness problems, that is,
   * some signals are not constrained correctly, then you may be able to create a fake witness by
   * overriding specific values, and pass the constraints check.
   *
   * The symbol names must be given in full form, not just as the signal is named in the circuit code. In
   * general a symbol name looks something like:
   *
   * - `main.signal`
   * - `main.component.signal`
   * - `main.component.signal[n][m]`
   *
   * You will likely call `checkConstraints` on the resulting fake witness to see if it can indeed fool
   * a verifier.
   * @see {@link checkConstraints}
   *
   * @param witness a witness array
   * @param symbolValues symbols to be overridden in the witness
   * @returns fake witness
   */
  async fakeWitness(
    witness: Readonly<WitnessType>,
    symbolValues: {[symbolName: string]: bigint}
  ): Promise<WitnessType> {
    await this.loadSymbols();

    const fakeWitness = witness.slice();
    for (const symbolName in symbolValues) {
      // get corresponding symbol
      const symbolInfo = this.symbols![symbolName];
      if (symbolInfo === undefined) {
        throw new Error('Invalid symbol name: ' + symbolName);
      }

      // override with user value
      fakeWitness[symbolInfo.varIdx] = symbolValues[symbolName];
    }

    return fakeWitness;
  }

  /**
   * Compiles and reutrns a circuit tester class instance.
   * @param circuit name of circuit
   * @param dir directory to read the circuit from, defaults to `test`
   * @returns a `WasmTester` instance
   */
  static async new<IN extends string[] = [], OUT extends string[] = []>(
    circuitName: string,
    circuitConfig: CircuitConfig
  ): Promise<WasmTester<IN, OUT>> {
    const dir = circuitConfig.dir || 'test';
    instantiate(circuitName, circuitConfig);
    const circomWasmTester: CircomWasmTester = await wasm_tester(`./circuits/${dir}/${circuitName}.circom`, {
      include: 'node_modules', // will link circomlib circuits
    });
    return new WasmTester<IN, OUT>(circomWasmTester);
  }
}
