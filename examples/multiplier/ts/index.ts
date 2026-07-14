// End-to-end Circomkit walkthrough using the native npm library (napi bindings).
//
// Mirrors ../e2e.sh (the CLI walkthrough), but via the `circomkit` package:
// compile, trusted setup, witness, prove, verify.
//
// Requires `circom` and `snarkjs` on your PATH, and the addon to be built
// (see this folder's README).
//
// Run with:  bun index.ts     (or)   node index.ts   (Node 23.6+)

import { dirname, join } from "node:path";
import { chdir } from "node:process";
import { fileURLToPath } from "node:url";

import { Circomkit } from "circomkit";

// Run from the shared example project so the config's relative paths resolve.
const here = dirname(fileURLToPath(import.meta.url));
chdir(join(here, ".."));

const circuit = "multiplier_3";
const input = "default";

const ck = Circomkit.fromFile("circomkit.json");

console.log(`>> Compiling ${circuit}`);
ck.compile(circuit);

const info = ck.info(circuit);
console.log(`   wires=${info.wires} constraints=${info.constraints} prime=${info.primeName ?? ""}`);

console.log(">> Trusted setup (auto-downloads PTAU for bn128)");
ck.setup(circuit);
ck.vkey(circuit);

console.log(`>> Computing the witness for input '${input}'`);
ck.witness(circuit, input);

console.log(">> Generating a proof");
ck.prove(circuit, input);

console.log(">> Verifying the proof");
const ok = ck.verify(circuit, input);
console.log(`   proof valid: ${ok}`);
if (!ok) process.exit(1);

console.log(`Done. Artifacts under ./build/${circuit}`);
