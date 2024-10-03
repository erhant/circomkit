declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-var
  var curve_bn128: any;
}

export function teardown() {
  if (globalThis.curve_bn128) globalThis.curve_bn128.terminate();
}
