after(async () => {
  // SnarkJS may attach curve_bn128 to global, but does not terminate it.
  // we have to do it manually

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  if (globalThis.curve_bn128) await globalThis.curve_bn128.terminate();
});
