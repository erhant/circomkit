import ejs from 'ejs';
import {writeFileSync, readFileSync, existsSync, mkdirSync} from 'fs';
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
  // add "../" to the filename in include, one for each "/" in directory name
  // if none, the prefix becomes empty string
  const filePrefix = '../'.repeat((directory.match(/\//g) || []).length);

  let circuit = ejs.render(readFileSync(ejsPath).toString(), {
    ...circuitConfig,
    file: filePrefix + circuitConfig.file, // TODO: add ../'s based on dir
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
  // console.log(`Main component created at: ${targetPath}\n`);
}

export function clearTestInstance(name: string, directory: string) {
  // TODO: remove the file
}

if (require.main === module) {
  const name = process.argv[2];
  const directory = process.argv[3];
  instantiate(name, directory);
}
