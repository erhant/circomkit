after(async () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  await globalThis.curve_bn128.terminate();
});
