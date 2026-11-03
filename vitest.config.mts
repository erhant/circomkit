import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // globals keep the test files runnable with `bun test` too
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 100_000,
    hookTimeout: 100_000,
  },
});
