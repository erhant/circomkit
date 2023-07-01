import type {CircomkitConfig} from '../types/circomkit';

/** A mapping from prime (decimals) to prime name. */
export const primeToName: {[key: `${number}`]: CircomkitConfig['prime']} = {
  '21888242871839275222246405745257275088548364400416034343698204186575808495617': 'bn128',
  '52435875175126190479447740508185965837690552500527637822603658699938581184513': 'bls12381',
  '18446744069414584321': 'goldilocks',
} as const;

/** JSON Stringify with a prettier format. */
export function prettyStringify(obj: unknown): string {
  return JSON.stringify(obj, undefined, 2);
}

/**
 * Initial files for Cirocmkit development environment.
 * This is most likely to be used by the CLI via `npx circomkit init`.
 *
 * It has the following:
 *
 * - An example circuit.
 * - A circuit config for that circuit.
 * - An input for that circuit.
 * - A test code for that circuit.
 * - A `.mocharc.json` for the tests.
 */
export const initFiles = {
  circuit: {
    dir: 'circuits',
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
    dir: 'inputs/multiplier_3',
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
  }
}
`,
  },
  tests: {
    dir: 'tests',
    name: 'multiplier.test.ts',
    content: `import { Circomkit } from "circomkit";

// exercise: make this test work for all numbers, not just 3
describe("multiplier", () => {
  let circuit: WitnessTester<["in"], ["out"]>;

  before(async () => {
    const circomkit = new Circomkit();
    circuit = await circomkit.WitnessTester('multiplier_3', {
      file: "multiplier",
      template: "Multiplier",
      params: [3],
    });
  });

  it("should multiply correctly", async () => {
    await circuit.expectPass({ in: [2, 4, 10] }, { out: 80 });
  });
});
`,
  },
  mochaConfig: {
    dir: '.',
    name: '.mocharc.json',
    content: `{
  "extension": ["ts"],
  "require": "ts-node/register",
  "spec": "tests/**/*.ts",
  "timeout": 100000,
  "exit": true
}
`,
  },
} satisfies {
  [key: string]: {
    dir: string;
    name: string;
    content: string;
  };
};

export const postInitString = `
You should also install the following packages if you need to:

  npm install --save-dev ts-node typescript mocha @types/mocha

`;

export const usageString = `Usage:

  Compile the circuit.
  > compile circuit

  Create main component.
  > instantiate circuit
  
  Print circuit information.
  > info circuit

  Clean build artifacts & main component.
  > clean circuit

  Export Solidity verifier.
  > contract circuit
  
  Export calldata for a verifier contract.
  > calldata circuit input

  Export JSON for a chosen file.
  > json r1cs circuit
  > json zkey circuit
  > json wtns circuit input

  Commence circuit-specific setup.
  > setup circuit
  > setup circuit ptau-path
  
  Download the PTAU file needed for the circuit.
  > ptau circuit

  Generate a proof.
  > prove circuit input 

  Verify a proof.
  > verify circuit input

  Generate a witness.
  > witness circuit input
  
  Initialize a Circomkit project.
  > init                # initializes in current folder
  > init project-name   # initializes in a new folder

  Print configurations to console.
  > config
`;
