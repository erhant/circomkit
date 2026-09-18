import {isBun} from '../src/utils';

describe('isBun', () => {
  it('should return false when running under Node.js', () => {
    expect(isBun()).toBe(false);
  });

  it('should return true when Bun global is defined', () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.Bun = {};
    expect(isBun()).toBe(true);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete global.Bun;
  });
});
