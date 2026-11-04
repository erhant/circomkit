import {AssertionError} from 'node:assert';
import path from 'node:path';
import {
  formatConstraints,
  iterateSymbols,
  type R1CSConstraints,
  readR1CSConstraints,
  readSymbols,
} from '../functions/r1cs';
import {cWitnessCalculatorPath, type WitnessCalculator} from '../functions/witness';
import type {CircuitSignals, SignalValueType, SymbolsType, WitnessType} from '../types/';

/** A utility class to test your circuits. Use `expectFail` and `expectPass` to test out evaluations. */
export class WitnessTester<IN extends readonly string[] = [], OUT extends readonly string[] = []> {
  /** A dictionary of symbols, see {@link loadSymbols} */
  private symbols: SymbolsType = {};
  /** Whether all symbols are loaded, see {@link loadSymbols} and {@link loadSpecificSymbols} */
  private allSymbolsLoaded = false;
  /** Constraints `A * B = C`, see {@link loadConstraints} */
  private r1csConstraints: R1CSConstraints | undefined;

  constructor(
    /** The build directory of the circuit */
    private readonly dir: string,
    /** The circuit name, i.e. the base name of the files in `dir` */
    private readonly name: string,
    /** Computes the witness for an input */
    private readonly witnessCalculator: WitnessCalculator
  ) {}

  /** Assert that constraints are valid for a given witness. */
  async expectConstraintPass(witness: WitnessType): Promise<void> {
    const {prime: p, offsets, wires, coefficientIds, coefficients} = this.loadConstraints();
    const evaluate = (k: number) => {
      let sum = 0n;
      for (let t = offsets[k]; t < offsets[k + 1]; t++) {
        sum = (sum + coefficients[coefficientIds[t]] * BigInt(witness[wires[t]])) % p;
      }
      return sum;
    };

    for (let k = 0; k < offsets.length - 1; k += 3) {
      // edited witnesses may hold values out of the field, hence the double modulo
      if ((((evaluate(k) * evaluate(k + 1) - evaluate(k + 2)) % p) + p) % p !== 0n) {
        throw new Error("Constraint doesn't match");
      }
    }
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
    return this.witnessCalculator(input);
  }

  /** Returns the constraints as human-readable formulas, e.g. `in[0] * in[1] = inner[0]`.
   *
   * With a `filter`, only the constraints using that signal or component are returned, e.g. `isZero[0]`.
   */
  async constraints(filter?: string): Promise<string[]> {
    const lines: string[] = [];
    const r1csPath = path.join(this.dir, `${this.name}.r1cs`);
    for await (const line of formatConstraints(r1csPath, path.join(this.dir, `${this.name}.sym`), filter)) {
      lines.push(line);
    }
    return lines;
  }

  /** Returns the number of constraints. */
  async getConstraintCount() {
    return (this.loadConstraints().offsets.length - 1) / 3;
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
          // other run-time errors of the witness calculator
          'Error: Out of bounds array access.',
          'Error: Input signal array access exceeds the size.',
          'Error: Signal already set.',
          'Error: Too many signals set.',
          'Error: Signal not found.',
          'RuntimeError:', // a WASM trap, e.g. modulo by zero
          // the C witness calculator exits with an error (or a signal, e.g. SIGFPE on modulo by zero)
          `Command failed: ${cWitnessCalculatorPath(this.dir, this.name)} `,
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
   * - `main.Template_line_offset.signal` for anonymous components, e.g. `main.Square_3_158.out` for a
   *   `Square()(...)` call at line 3, where `158` is the byte offset of the call in its file
   *
   * You will likely call `expectConstraintPass` on the resulting fake witness to see if it can indeed fool
   * a verifier.
   * @see {@link expectConstraintPass}
   */
  async editWitness(
    witness: Readonly<WitnessType>,
    symbolValues: {[symbolName: string]: bigint}
  ): Promise<WitnessType> {
    this.loadSymbols();

    const fakeWitness = witness.slice();
    for (const symbolName in symbolValues) {
      fakeWitness[this.varIdx(symbolName)] = symbolValues[symbolName];
    }

    return fakeWitness;
  }

  /** Read symbol values from a witness. */
  async readWitness(witness: Readonly<WitnessType>, symbols: string[]): Promise<Record<string, bigint>> {
    await this.loadSpecificSymbols(symbols);

    const ans: Record<string, bigint> = {};
    for (const symbolName of symbols) {
      ans[symbolName] = witness[this.varIdx(symbolName)];
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
   * Signals are named as in the `main` component, i.e. without the `main.` prefix. Arrays are returned as arrays and
   * buses as objects, and parts of them can be read too, e.g. `out[1]` or `point.x`. To read signals within a
   * component, refer to them as `component.signal`, e.g. `hasher.out` or `hashers[0].out`.
   * Anonymous components are named like `Square_3_158`, see {@link editWitness}.
   */
  async readWitnessSignals(witness: Readonly<WitnessType>, signals: string[] | OUT): Promise<CircuitSignals> {
    const symbols = this.loadSymbols();

    // places the value at the path of indices & bus fields within the value of a signal
    type Value = bigint | Value[] | {[field: string]: Value};
    const place = (into: Value | undefined, path: (number | string)[], value: bigint): Value => {
      if (path.length === 0) return value;
      const [key, ...rest] = path;
      const container = (into ?? (typeof key === 'number' ? [] : {})) as Record<number | string, Value>;
      container[key] = place(container[key], rest, value);
      return container;
    };

    const entries: [string, Value][] = [];
    for (const signal of signals) {
      const prefix = `main.${signal}`;
      let value: Value | undefined;
      for (const symbol in symbols) {
        if (symbol !== prefix && !symbol.startsWith(`${prefix}[`) && !symbol.startsWith(`${prefix}.`)) continue;

        // e.g. `[1][0]` for an array element, or `.x` for a bus field
        const path = [...symbol.slice(prefix.length).matchAll(/\[(\d+)\]|\.([^.[]+)/g)].map(([, index, field]) =>
          index !== undefined ? Number(index) : field
        );
        value = place(value, path, witness[this.varIdx(symbol)]);
      }
      if (value === undefined) {
        throw new Error(`No symbols matched for signal: ${signal}`);
      }
      entries.push([signal, value]);
    }

    return Object.fromEntries(entries) as CircuitSignals;
  }

  /**
   * Assert the output of a given witness.
   * @param actualOut expected witness
   * @param expectedOut computed output signals
   */
  private async assertOut(actualOut: WitnessType, expectedOut: CircuitSignals<OUT>): Promise<void> {
    const symbols = this.loadSymbols();

    // objects are not in the types, but are accepted at run-time, e.g. for buses
    const check = (prefix: string, expected: SignalValueType | {[key: string]: SignalValueType}) => {
      if (Array.isArray(expected)) {
        for (const [i, e] of expected.entries()) check(`${prefix}[${i}]`, e);
      } else if (typeof expected === 'object') {
        for (const key in expected) check(`${prefix}.${key}`, expected[key]);
      } else {
        const symbol = symbols[prefix];
        if (symbol === undefined) {
          throw new Error(`Output variable not defined: ${prefix}`);
        }
        const [actual, exp] = [actualOut[symbol.varIdx].toString(), expected.toString()];
        if (actual !== exp) {
          throw new Error(`Assertion failed for ${prefix}: expected ${exp}, got ${actual}`);
        }
      }
    };
    for (const signal in expectedOut) {
      check(`main.${signal}`, expectedOut[signal as OUT[number]]);
    }
  }

  /** Returns the witness index of a loaded symbol, throwing if it is unknown or optimized away. */
  private varIdx(symbolName: string): number {
    const symbolInfo = this.symbols[symbolName];
    if (symbolInfo === undefined) {
      throw new Error(`Invalid symbol name: ${symbolName}`);
    }
    if (symbolInfo.varIdx === -1) {
      throw new Error(
        `Symbol ${symbolName} was optimized away by the compiler, use a lower optimization level to keep it`
      );
    }
    return symbolInfo.varIdx;
  }

  /** Returns the R1CS constraints, reading them on the first call. */
  private loadConstraints(): R1CSConstraints {
    if (!this.r1csConstraints) {
      this.r1csConstraints = readR1CSConstraints(path.join(this.dir, `${this.name}.r1cs`));
    }
    return this.r1csConstraints;
  }

  /**
   * Returns all symbols, reading them to `this.symbols` on the first call.
   * Symbols are stored under the .sym file
   *
   * Each line has 4 comma-separated values:
   *
   * 1.  symbol name
   * 2.  label index
   * 3.  variable index
   * 4.  component index
   */
  private loadSymbols(): SymbolsType {
    if (!this.allSymbolsLoaded) {
      this.symbols = readSymbols(path.join(this.dir, `${this.name}.sym`));
      this.allSymbolsLoaded = true;
    }
    return this.symbols;
  }

  /** Faster alternative to {@link loadSymbols}, stops once all the requested symbols are found */
  private async loadSpecificSymbols(symbolsRequested: string[]): Promise<void> {
    // Identify which symbols are still needed
    const symbolsToFind = new Set(symbolsRequested.filter(s => !this.symbols[s]));
    if (symbolsToFind.size === 0) return;

    for (const [name, symbol] of iterateSymbols(path.join(this.dir, `${this.name}.sym`))) {
      if (!symbolsToFind.has(name)) continue;
      this.symbols[name] = symbol;
      symbolsToFind.delete(name);
      if (symbolsToFind.size === 0) return; // stops reading once all are found
    }
  }
}
