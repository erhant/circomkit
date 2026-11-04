import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';

/** Files of a new project, by their path in it. */
const TEMPLATE: Record<string, string> = {
  'circomkit.json': `{
  "$schema": "./node_modules/circomkit/schema.json",
  "circuits": {
    "multiplier_3": {
      "file": "multiplier",
      "template": "Multiplier",
      "params": [3]
    }
  }
}
`, ////////////////////////////////////////////////////////////////////////////
  'circuits/multiplier.circom': `pragma circom 2.0.0;

// Multiplies \`n\` numbers, see \`circomkit.json\` for its instances.
template Multiplier(n) {
  signal input in[n];
  signal output out;

  signal inner[n];
  inner[0] <== in[0];
  for (var i = 1; i < n; i++) {
    inner[i] <== inner[i - 1] * in[i];
  }
  out <== inner[n - 1];
}
`, ////////////////////////////////////////////////////////////////////////////
  'inputs/multiplier_3.json': `{
  "in": [2, 3, 5]
}
`, ////////////////////////////////////////////////////////////////////////////
  '.gitignore': `build/
ptau/
`,
};

/** Creates a new Circomkit project from a template under `dir`, never overwriting existing files.
 *
 * @returns the paths of created & skipped (existing) files
 */
export function initProject(dir: string): {created: string[]; skipped: string[]} {
  const created: string[] = [];
  const skipped: string[] = [];
  for (const [file, content] of Object.entries(TEMPLATE)) {
    const path = join(dir, file);
    if (existsSync(path)) {
      skipped.push(path);
    } else {
      mkdirSync(dirname(path), {recursive: true});
      writeFileSync(path, content);
      created.push(path);
    }
  }
  return {created, skipped};
}
