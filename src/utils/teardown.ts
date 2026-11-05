// @ts-expect-error
import {buildBls12381, buildBn128} from 'ffjavascript';

type Curve = {terminate: () => Promise<void>};
declare global {
  var curve_bn128: Curve | undefined;
  var curve_bls12381: Curve | undefined;
}

/**
 * Terminates the worker threads of SnarkJS, so that a script can exit once it is done.
 *
 * SnarkJS caches its curves (with their worker threads) on `globalThis` and never terminates them,
 * see [snarkjs#152](https://github.com/iden3/snarkjs/issues/152). Test runners exit anyway, but plain scripts hang.
 * SnarkJS can still be used afterwards, as it builds the curves again when needed.
 */
export async function teardown() {
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
  if (globalThis.curve_bls12381) await globalThis.curve_bls12381.terminate();
}

/**
 * SnarkJS crashes on Bun with its worker threads, and only proving takes a `singleThread` option.
 *
 * ffjavascript caches the multi-threaded curves on `globalThis` and SnarkJS reuses them everywhere,
 * so on Bun we put single-threaded curves there instead. Does nothing on Node.
 */
export async function singleThreadOnBun() {
  if (!('Bun' in globalThis)) return;
  globalThis.curve_bn128 ??= await buildBn128(true);
  globalThis.curve_bls12381 ??= await buildBls12381(true);
}
