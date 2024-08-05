/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  rootDir: './tests',
  testTimeout: 100000,
  globalTeardown: '<rootDir>/hooks/teardown.js',
  forceExit: true,
  detectOpenHandles: true,
  transform: {
    '^.+\\.test.(ts|js)$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.test.json',
      },
    ],
  },
};
