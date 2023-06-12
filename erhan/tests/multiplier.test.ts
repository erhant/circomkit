import { WasmTester } from "circomkit";

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
    await circuit.expectPass({ in: [2, 4, 10] }, { out: 80 });
  });
});
