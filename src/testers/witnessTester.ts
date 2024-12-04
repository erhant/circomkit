import {AssertionError} from 'node:assert';
import type {CircomTester, WitnessType, CircuitSignals, SymbolsType, SignalValueType} from '../types/';

// @todo detect optimized symbols https://github.com/erhant/circomkit/issues/80

/** A utility class to test your circuits. Use `expectFail` and `expectPass` to test out evaluations. */
export class WitnessTester<IN extends readonly string[] = [], OUT extends readonly string[] = []> {
  /** A dictionary of symbols, see {@link loadSymbols} */
  private symbols: SymbolsType | undefined;
  /** List of constraints, see {@link loadConstraints} */
  private constraints: unknown[] | undefined;

  constructor(
    /** The underlying `circom_tester` object */
    private readonly circomTester: CircomTester
  ) {}

  /** Assert that constraints are valid for a given witness. */
  async expectConstraintPass(witness: WitnessType): Promise<void> {
    return this.circomTester.checkConstraints(witness);
  }

  /**
   * Assert that constraints are NOT valid for a given witness.
   * This is useful to test if a fake witness (a witness from a
   * dishonest prover) can still be valid, which would indicate
   * that there are soundness errors in the circuit.
   */
  async expectConstraintFail(witness: WitnessType): Promise<void> {
    await this.expectConstraintPass(witness).then(
      () => {
        throw new AssertionError({message: 'Expected constraints to not match.'});
      },
      err => {
        if (err.message !== "Constraint doesn't match") {
          throw new AssertionError({message: err.message});
        }
      }
    );
  }

  /** Compute witness given the input signals. */
  async calculateWitness(input: CircuitSignals<IN>): Promise<WitnessType> {
    return this.circomTester.calculateWitness(input, false);
  }

  /** Returns the number of constraints. */
  async getConstraintCount() {
    if (this.constraints === undefined) {
      await this.loadConstraints();
    }
    const numConstraints = this.constraints!.length;
    return numConstraints;
  }

  /** Asserts that the circuit has enough constraints.
   *
   * By default, this function checks if there **at least** `expected` many constraints in the circuit.
   * If `exact` option is set to `true`, it will also check if the number of constraints is exactly equal to
   * the `expected` amount.
   *
   * If first check fails, it means the circuit is under-constrained. If the second check fails, it means
   * the circuit is over-constrained.
   */
  async expectConstraintCount(expected: number, exact?: boolean) {
    const count = await this.getConstraintCount();
    if (count < expected) {
      throw new AssertionError({
        message: 'Circuit is under-constrained',
        expected,
        actual: count,
      });
    }

    if (exact && count !== expected) {
      throw new AssertionError({
        message: 'Circuit is over-constrained',
        expected,
        actual: count,
      });
    }
  }

  /** Expect a witness computation to fail in the circuit.
   *
   * See [here](https://github.com/iden3/circom/blob/master/code_producers/src/wasm_elements/common/witness_calculator.js#L21)
   * for the list of errors that may occur during witness calculation.
   * Most of the time, you will be expecting an assertion error.
   *
   * @returns the error message.
   */
  async expectFail(input: CircuitSignals<IN>): Promise<string> {
    return await this.calculateWitness(input).then(
      () => {
        throw new AssertionError({
          message: 'Expected witness calculation to fail.',
        });
      },
      err => {
        const errorMessage = (err as Error).message;

        const isExpectedError = [
          'Error: Assert Failed.', // a constraint failure (most common)
          'Not enough values for input signal', // few inputs than expected for a signal
          'Too many values for input signal', // more inputs than expected for a signal
          'Not all inputs have been set.', // few inputs than expected for many signals
        ].some(msg => errorMessage.startsWith(msg));

        // throw unhandled error anyways
        if (!isExpectedError) throw err;

        return errorMessage;
      }
    );
  }

  /** Expect an input to pass assertions and match the output.
   *
   * If `output` is omitted, it will only check for constraints to pass.
   */
  async expectPass(input: CircuitSignals<IN>, output?: CircuitSignals<OUT>) {
    const witness = await this.calculateWitness(input);
    await this.expectConstraintPass(witness);
    if (output) {
      await this.assertOut(witness, output);
    }
  }

  /**
   * Computes the witness.
   * This is a shorthand for calculating the witness and calling {@link readWitnessSignals} on the result.
   */
  async compute(input: CircuitSignals<IN>, signals: string[] | OUT): Promise<CircuitSignals> {
    // compute witness & check constraints
    const witness = await this.calculateWitness(input);
    await this.expectConstraintPass(witness);

    return await this.readWitnessSignals(witness, signals);
  }

  /**
   * Parse R1CS constraints into human-readable formulas.
   */
  async parseConstraints(): Promise<string[]> {
    await this.loadConstraints();
    await this.loadSymbols();

    // @ts-ignore
    const varsById = Object.entries(this.symbols).reduce((out, cur) => {
      // @ts-ignore
      const id = cur[1].varIdx;
      if(id !== -1) {
        // @ts-ignore
        out[id] = cur[0].slice(5); // Remove main.
      }
      return out;
    }, {});

    // @ts-ignore
    const fieldSize = this.circomTester.witnessCalculator.prime;

    // @ts-ignore
    const parsedConstraints = this.constraints.map(constraint => {
      // Every constraint is 3 groups: <1> * <2> - <3> = 0
      // @ts-ignore
      const groups = constraint.map(item => {
        // Each group can contain many signals (with coefficients) summed
        const vars = Object.keys(item).reduce((out, cur) => {
          // @ts-ignore
          const coeffRaw = item[cur];
          // Display the coefficient as a signed value, helps a lot with -1
          let coeff = coeffRaw > fieldSize / BigInt(2) ? coeffRaw - fieldSize : coeffRaw;
          // Reduce numbers that are factors of the field size for better readability
          // @ts-ignore
          const modP = BigInt(fieldSize % coeff);
          // XXX: Why within 10000?
          if(modP !== BigInt(0) && modP <= BigInt(10000)) {
            coeff = `(ρ-${fieldSize % coeff})/${fieldSize/coeff}`;
          }
          // @ts-ignore
          const varName = varsById[cur];
          out.push(
            // @ts-ignore
            coeff === BigInt(-1) && varName ? '-' + varName :
            coeff === BigInt(1) && varName ? varName :
            !varName ? `${coeff}` :
            `(${coeff} * ${varName})`,
          );
          return out;
        }, []);

        // Combine all the signals into one statement
        return vars.reduce((out, cur, index) =>
          // @ts-ignore
          out + (index > 0 ? cur.startsWith('-') ? ` - ${cur.slice(1)}` : ` + ${cur}` : cur),
          '');
      })
        // @ts-ignore
        .map(curVar => curVar.indexOf(' ') === -1 ? curVar : `(${curVar})`);

      return (
        groups[0] +
        (groups[1] ? ' * ' + groups[1] : '') +
        (groups[2] ?
          groups[2].startsWith('-') ?
            ` + ${groups[2].slice(1)}`
            : groups[0] || groups[1] ?
              ' - ' + groups[2]
              : groups[2].startsWith('(') ?
                groups[2].slice(1, -1)
                : groups[2]
          : '') +
        ' = 0'
      );
    });
    // @ts-ignore
    return parsedConstraints;
  }

  /**
   * Override witness value to try and fake a proof. If the circuit has soundness problems (i.e.
   * some signals are not constrained correctly), then you may be able to create a fake witness by
   * overriding specific values, and pass the constraints check.
   *
   * The symbol names must be given in full form, not just as the signal is named in the circuit code. In
   * general a symbol name looks something like:
   *
   * - `main.signal`
   * - `main.component.signal`
   * - `main.component.signal[n][m]`
   *
   * You will likely call `expectConstraintPass` on the resulting fake witness to see if it can indeed fool
   * a verifier.
   * @see {@link expectConstraintPass}
   */
  async editWitness(
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

  /** Read symbol values from a witness. */
  async readWitness(witness: Readonly<WitnessType>, symbols: string[]): Promise<Record<string, bigint>> {
    await this.loadSymbols();

    const ans: Record<string, bigint> = {};
    for (const symbolName of symbols) {
      // get corresponding symbol
      const symbolInfo = this.symbols![symbolName];
      if (symbolInfo === undefined) {
        throw new Error('Invalid symbol name: ' + symbolName);
      }

      // override with user value
      ans[symbolName] = witness[symbolInfo.varIdx];
    }

    return ans;
  }

  /**
   * Read signals from a witness.
   *
   * This is not the same as {@link readWitness} in the sense that the entire value represented by a signal
   * will be returned here. For example, instead of reading `main.out[0], main.out[1], main.out[2]` with `readWitness`,
   * you can simply query `out` in this function and an object with `{out: [...]}` will be returned.
   *
   * To read signals within a component, simply refer to them as `component.signal`. In other words, omit the `main.` prefix
   * and array dimensions.
   */
  async readWitnessSignals(witness: Readonly<WitnessType>, signals: string[] | OUT): Promise<CircuitSignals> {
    await this.loadSymbols();

    // for each out signal, process the respective symbol
    const entries: [OUT[number], SignalValueType][] = [];

    // returns the dot count in the symbol
    // for example `main.inner.in` has 2 dots
    function dotCount(s: string): number {
      return s.split('.').length;
    }

    for (const signal of signals) {
      // if our symbol has N dots (0 for `main` signals), we must filter symbols that have different
      // amount of dots. this shall speed-up the rest of the algorithm, as symbol count may be large
      // non-main signals have an additional `.` in them after `main.symbol`
      const signalDotCount = dotCount(signal) + 1; // +1 for the dot in `main.`
      const signalLength = signal.length + 5; // +5 for prefix `main.`
      const symbolNames = Object.keys(this.symbols!).filter(
        s => s.match(new RegExp(`^main\\.${signal}(\\[|$|\\.)`)) && signalDotCount === dotCount(s)
      );

      // get the symbol values from symbol names, ignoring `main.` prefix
      // the matched symbols must exactly equal the signal
      const matchedSymbols = symbolNames.filter(s => {
        const i = s.indexOf('[');
        if (i === -1) {
          // not an array signal
          return s.length === signalLength;
        } else {
          // an array signal, we only care about the symbol name
          return s.slice(0, i).length === signalLength;
        }
      });

      if (matchedSymbols.length === 0) {
        // no matches!
        throw new Error('No symbols matched for signal: ' + signal);
      } else if (matchedSymbols.length === 1) {
        // easy case, just return the witness of this symbol
        entries.push([signal, witness[this.symbols![matchedSymbols[0]].varIdx]]);
      } else {
        // since signal names are consequent, we only need to know the witness index of the first symbol
        let idx = this.symbols![matchedSymbols[0]].varIdx;

        // we can assume that a symbol with this name appears only once in a component, and that the depth is same for
        // all occurences of this symbol, given the type system used in Circom. So, we can just count the number
        // of `[`s in any symbol of this signal to find the number of dimensions of this signal.
        // we particularly choose the last symbol in the array, as that holds the maximum index of each dimension of this array.
        const splits = matchedSymbols.at(-1)!.split('[');

        // since we chose the last symbol, we have something like `main.signal[dim1][dim2]...[dimN]` which we can parse
        const dims = splits.slice(1).map(dim => parseInt(dim.slice(0, -1)) + 1); // +1 is needed because the final value is 0-indexed

        // at this point, we have an array of signals like `main.signal[0..dim1][0..dim2]..[0..dimN]`
        // and we must construct the necessary multi-dimensional array out of it.
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
        entries.push([signal, processDepth(0)]);
      }
    }

    return Object.fromEntries(entries) as CircuitSignals<OUT>;
  }

  /**
   * Assert the output of a given witness.
   * @param actualOut expected witness
   * @param expectedOut computed output signals
   */
  private assertOut(actualOut: WitnessType, expectedOut: CircuitSignals<OUT>): Promise<void> {
    return this.circomTester.assertOut(actualOut, expectedOut);
  }

  /** Loads the list of R1CS constraints to `this.constraints`. */
  private async loadConstraints(): Promise<void> {
    await this.circomTester.loadConstraints();
    this.constraints = this.circomTester.constraints;
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
  private async loadSymbols(): Promise<void> {
    // no need to check if symbols are already defined
    // that check happens within circomWasmTester
    await this.circomTester.loadSymbols();
    this.symbols = this.circomTester.symbols;
  }

  /**
   * @deprecated this is buggy right now
   * @param witness witness
   */
  private getDecoratedOutput(witness: WitnessType): Promise<string> {
    return this.circomTester.getDecoratedOutput(witness);
  }

  /**
   * Cleanup directory, should probably be called upon test completion (?)
   * @deprecated this is buggy right now
   */
  private release(): Promise<void> {
    return this.circomTester.release();
  }
}
