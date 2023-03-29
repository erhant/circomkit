import type {WasmTester} from '../types/wasmTester';
const wasm_tester = require('circom_tester').wasm;

/**
 * Compiles and reutrns a circuit via `circom_tester`'s `wasm_tester`.
 * @param circuit name of circuit
 * @param showNumConstraints print number of constraints, defualts to `false`
 * @returns a `wasm_tester` object
 */
export async function createWasmTester(path: string, showNumConstraints: boolean = false): Promise<WasmTester> {
  const circuit = await wasm_tester(path, {
    include: 'node_modules', // will link circomlib circuits
  });

  if (showNumConstraints) {
    await circuit.loadConstraints();
    console.log('    number of constraints:', circuit.constraints!.length);
  }

  return circuit;
}
