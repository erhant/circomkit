import path from 'path';
import {createHash} from 'crypto';
import type {WasmTester} from '../types/wasmTester';
import {EVM_FF_ORDER} from '../constants/';
import {sha256} from 'ethers';
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

/**
 * Hash an arbitrary JSON object.
 * @param preimage can be anything
 * @param algorithm algorithm to be used for hashing, defaults to `sha256`
 * @returns a BigInt representing the 256-bit hash result
 */
export function jsonToHash(preimage: any, algorithm: string = 'sha256'): bigint {
  return BigInt('0x' + createHash(algorithm).update(JSON.stringify(preimage)).digest('hex')) % EVM_FF_ORDER;
}

/**
 * Hash an arbitrary JSON object using SHA256.
 * @param preimage can be anything
 * @returns a BigInt representing the 256-bit hash result
 */
export function jsonToHashEthersSHA256(preimage: any): bigint {
  return BigInt(sha256(Buffer.from(JSON.stringify(preimage)))) % EVM_FF_ORDER;
}

/**
 * Map any given string to BigInt. This could be useful when you have a string
 * that represents an ID, and you would like to use it within a proof.
 */
export function stringToBigInt(str: string): bigint {
  return BigInt('0x' + Buffer.from(str).toString('hex')) % EVM_FF_ORDER;
}
