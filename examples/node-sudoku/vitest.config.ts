import {defineConfig} from 'vitest/config';

// compiling a circuit can take longer than the default timeouts
export default defineConfig({test: {testTimeout: 60_000, hookTimeout: 60_000}});
