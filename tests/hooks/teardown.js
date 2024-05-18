// This is a Jest environment teardown script, runs only once after all tests.
module.exports = async () => {
  // SnarkJS may attach curve_bn128 to global, but does not terminate it.
  // We have to do it manually (see https://github.com/iden3/snarkjs/issues/152)
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
};
