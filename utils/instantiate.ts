import ejs from 'ejs';
import {writeFileSync, readFileSync, existsSync, mkdirSync} from 'fs';
import config from '../circuit.config';
import {CircuitConfig} from '../types/config';

/**
 * Programmatically generate the `main` component
 * @param name name of the circuit to be generated
 * @param directory name of the directory under circuits to be created. Can be given sub-folders like `test/myCircuit/foobar`.
 * @param circuitConfig circuit configurations, if `undefined` then `circuit.config.ts` will be used.
 */
export function instantiate(name: string, directory: string, circuitConfig?: CircuitConfig) {
  // get config from circuit.config.ts if none are given
  if (circuitConfig === undefined) {
    if (!(name in config)) {
      throw new Error(`Target ${name} not found in circuit.config.cjs`);
    }
    circuitConfig = config[name];
  }

  // generate the main component code using the template
  const ejsPath = './circuits/ejs/template.circom';

  // add "../" to the filename in include, one for each "/" in directory name
  // if none, the prefix becomes empty string
  const filePrefix = '../'.repeat((directory.match(/\//g) || []).length);

  const circuit = ejs.render(readFileSync(ejsPath).toString(), {
    ...circuitConfig,
    file: filePrefix + circuitConfig.file,
  });

  // output to file
  const targetDir = `./circuits/${directory || 'main'}`;
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, {
      recursive: true,
    });
  }
  const targetPath = `${targetDir}/${name}.circom`;
  writeFileSync(targetPath, circuit);
}

if (require.main === module) {
  const name = process.argv[2];
  const directory = process.argv[3];
  instantiate(name, directory);
}
