// @ts-expect-error
import {buildBls12381, buildBn128} from 'ffjavascript';

type Curve = {terminate: () => Promise<void>};
declare global {
  var curve_bn128: Curve | undefined;
  var curve_bls12381: Curve | undefined;
}

/**
 * Teardown function to be run for graceful exits.
 *
 * SnarkJS may attach curve_bn128 to global, but does not terminate it.
 * We have to do it manually (see https://github.com/iden3/snarkjs/issues/152)
 * For this, we use the [`terminate`](https://github.com/iden3/ffjavascript/blob/master/src/bn128.js#L48) function.
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
