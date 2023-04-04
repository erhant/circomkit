import ejs from 'ejs';
import {writeFileSync, readFileSync} from 'fs';
import config from '../circuit.config';
import {CircuitConfig} from '../types/circuit';

/**
 * Programmatically generate the `main` component
 */
export function instantiate(name: string, directory: string, circuitConfig?: CircuitConfig) {
  if (circuitConfig == undefined) {
    if (!(name in config)) {
      throw new Error(`Target ${name} not found in circuit.config.cjs`);
    }
    circuitConfig = config[name];
  }

  // generate the main component code
  const ejsPath = './circuits/ejs/template.circom';
  let circuit = ejs.render(readFileSync(ejsPath).toString(), circuitConfig);

  // output to file
  const targetDir = directory || 'main';
  const targetPath = `./circuits/${targetDir}/${name}.circom`;
  writeFileSync(targetPath, circuit);
  console.log(`Main component created at: ${targetPath}\n`);
}

export function clearTestInstance(name: string, directory: string) {
  // TODO: remove the file
}

if (require.main === module) {
  const name = process.argv[2];
  const directory = process.argv[3];
  instantiate(name, directory);
}
