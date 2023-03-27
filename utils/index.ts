import type {WasmTester} from '../types/wasmTester';
const wasm_tester = require('circom_tester').wasm;

/**
 * Compiles and reutrns a circuit via `circom_tester`'s `wasm_tester`.
 * @param circuit name of circuit
 * @returns a `wasm_tester` object
 */
export async function compileCircuit(path: string): Promise<WasmTester> {
  return await wasm_tester(path, {
    include: 'node_modules', // will link circomlib circuits
  });
}
