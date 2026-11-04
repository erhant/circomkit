import {readFileSync} from 'node:fs';
import {Circomkit, type ProofTester} from 'circomkit';
import {beforeAll, describe, it} from 'vitest';

// reads the circuits from `circuits.json`, where some override the protocol
const circomkit = new Circomkit({verbose: false, logLevel: 'silent'});

for (const protocol of ['groth16', 'plonk', 'fflonk'] as const) {
  describe(`sudoku with ${protocol}`, () => {
    const circuitName = `sudoku_${protocol}`;
    const input = JSON.parse(readFileSync(`./inputs/${circuitName}.json`, 'utf-8'));
    let circuit: ProofTester<['solution', 'puzzle'], typeof protocol>;

    beforeAll(async () => {
      // the PTAU is downloaded for the protocol: PLONK & FFLONK need larger ones than Groth16
      await circomkit.compile(circuitName);
      await circomkit.setup(circuitName);
      circuit = await circomkit.ProofTester(circuitName, protocol);
    });

    it('should verify a proof', async () => {
      const {proof, publicSignals} = await circuit.prove(input);
      await circuit.expectPass(proof, publicSignals);
    });

    it('should not verify a proof for another puzzle', async () => {
      const {proof, publicSignals} = await circuit.prove(input);
      // the public signals are the puzzle's cells, the first one is blank
      await circuit.expectFail(proof, ['4', ...publicSignals.slice(1)]);
    });
  });
}
