/** THIS SCRIPT IS PRELOADED BY MOCHA BEFORE ALL TESTS, SO ALL THE HOOKS BELOW ARE ACTIVE. */

after(async () => {
  // SnarkJS may attach curve_bn128 to global, but does not terminate it.
  // We have to do it manually (see https://github.com/iden3/snarkjs/issues/152)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
});
