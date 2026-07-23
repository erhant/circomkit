// Circuit tests using the typed Circomkit testers (WitnessTester + ProofTester).
//
// Requires `circom` and `snarkjs` on PATH, and the addon built once:
//   cd ../../../bindings/napi && bun install && bun run build
//
// Run with:  bun test
//
// (Uses `bun:test`. Node users can adapt the imports to `node:test`; the
// Circomkit API is identical.)

import { beforeAll, describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { chdir } from "node:process";
import { fileURLToPath } from "node:url";

import { Circomkit } from "circomkit";

// Run from the shared example project so the config's relative paths resolve.
chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

const CIRCUIT = "multiplier_3";
const INPUT = { in: [2, 4, 10] };
const OUTPUT = { out: 80 };

const ck = Circomkit.fromFile("circomkit.json");

beforeAll(() => {
  // ProofTester needs the proving/verification keys — run the trusted setup
  // once (auto-downloads PTAU for bn128). Also compiles the circuit.
  ck.compile(CIRCUIT);
  ck.setup(CIRCUIT);
});

describe("WitnessTester", () => {
  // Typed over input/output signal names for object-shaped assertions.
  const t = ck.WitnessTester<["in"], ["out"]>(CIRCUIT);

  test("passes on correct input & output", () => {
    t.expectPass(INPUT, OUTPUT);
  });

  test("rejects a bad input (contains 1)", () => {
    const err = t.expectFail({ in: [1, 4, 10] });
    expect(err.length).toBeGreaterThan(0);
  });

  test("has the expected constraint count", () => {
    t.expectConstraintCount(15, true);
  });

  test("computes named output signals", () => {
    const out = t.compute(INPUT, ["out"]);
    expect(String(out.out)).toBe("80");
  });

  test("witness handle round-trip and tamper", () => {
    const w = t.calculateWitness(INPUT);

    // read a signal back from the opaque handle
    const signals = t.readWitnessSignals(w, ["out"]);
    expect(String(signals.out)).toBe("80");

    // tamper the output; the edited handle reflects the new value
    const bad = t.editWitness(w, { "main.out": "1234" });
    const badSignals = t.readWitnessSignals(bad, ["out"]);
    expect(String(badSignals.out)).toBe("1234");
  });
});

describe("ProofTester", () => {
  const pt = ck.ProofTester(CIRCUIT, "groth16");

  test("proves and verifies a valid proof", () => {
    const { proof, publicSignals } = pt.prove(INPUT);
    pt.expectPass(proof, publicSignals);
  });

  test("rejects a proof with tampered public signals", () => {
    const { proof, publicSignals } = pt.prove(INPUT);
    const tampered = [...publicSignals];
    tampered[0] = String(BigInt(tampered[0]) + 1n); // corrupt the public output
    pt.expectFail(proof, tampered);
  });
});
