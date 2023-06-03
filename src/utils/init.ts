/**
 * Initializes a development environment. This function is
 * most likely to be called from the CLI.
 *
 * It creates the following:
 *
 * - `circuits/multiplier.circom`
 * - `inputs/multiplier/default.json`
 * - `circuits.json`
 */

import {existsSync, mkdirSync, writeFileSync, writeSync} from 'fs';

export const initFiles = {
  circuit: {
    dir: './circuits',
    name: 'multiplier.circom',
    content: `pragma circom 2.0.0;
template Multiplier(N) {
  assert(N > 1);
  signal input in[N];
  signal output out;

  signal inner[N-1];
  inner[0] <== in[0] * in[1];
  for(var i = 2; i < N; i++) {
    inner[i-1] <== inner[i-2] * in[i];
  }
  out <== inner[N-2]; 
}`,
  },
  input: {
    dir: './inputs/multiplier_3',
    name: '80.json',
    content: `{
  "in": [2, 4, 10]
}
`,
  },
  circuits: {
    dir: '.',
    name: 'circuits.json',
    content: `{
  "multiplier_3": {
    "file": "multiplier",
    "template": "Multiplier",
    "params": [3]
  },
}
`,
  },
  tests: {
    dir: './tests',
    name: 'multipier.test.ts',
    content: `import { WasmTester } from "circomkit";

// exercise: make this test work for all numbers, not just 3
describe("multiplier", () => {
  let circuit: WasmTester<["in"], ["out"]>;

  before(async () => {
    circuit = await WasmTester.new('multiplier_3', {
      file: "multiplier",
      template: "Multiplier",
      params: [3],
    });
    await circuit.checkConstraintCount(2);
  });

  it("should multiply correctly", async () => {
    await circuit.expectCorrectAssert({ in: [3, 8, 20] }, { out: 480 });
  });
});

`,
  },
} satisfies {
  [key: string]: {
    dir: string;
    name: string;
    content: string;
  };
};
