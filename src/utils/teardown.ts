declare global {
  // eslint-disable-next-line no-var
  var curve_bn128: {terminate: () => Promise<void>} | undefined;
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
}
