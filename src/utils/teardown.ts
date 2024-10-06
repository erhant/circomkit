declare global {
  // eslint-disable-next-line no-var
  var curve_bn128: {terminate: () => void} | undefined;
}

export function teardown() {
  if (globalThis.curve_bn128) globalThis.curve_bn128.terminate();
}
