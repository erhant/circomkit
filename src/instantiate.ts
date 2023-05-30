import type {CircuitConfig} from './types/circuit';
import ejs from 'ejs';
import {writeFileSync, readFileSync, existsSync, mkdirSync} from 'fs';

/**
 * Programmatically generate the `main` component of a circuit
 * @param name name of the circuit to be generated
 * @param circuitConfig circuit configuration
 */
export default function instantiate(name: string, circuitConfig: CircuitConfig) {
  // directory to output the file
  const directory = circuitConfig.dir || 'test';

  // add "../" to the filename in include, one for each "/" in directory name
  // if none, the prefix becomes empty string
  const filePrefixMatches = directory.match(/\//g);
  if (filePrefixMatches !== null) {
    circuitConfig.file = '../'.repeat(filePrefixMatches.length) + circuitConfig.file;
  }

  // read EJS template
  const template = readFileSync('./ejs/template.circom').toString();

  // create circuit code
  const circuit = ejs.render(template, circuitConfig);

  // output to file
  const targetDir = `./circuits/${directory}`;
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, {
      recursive: true,
    });
  }
  const targetPath = `${targetDir}/${name}.circom`;
  writeFileSync(targetPath, circuit);
}
