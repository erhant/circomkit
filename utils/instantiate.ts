import ejs from 'ejs';
import {writeFileSync, readFileSync, existsSync, mkdirSync} from 'fs';
import config from '../circuit.config';
import {CircuitConfig} from '../types/config';

/**
 * Programmatically generate the `main` component of a circuit
 * @param name name of the circuit to be generated
 * @param circuitConfig circuit configuration
 */
export default function instantiate(name: string, circuitConfig: CircuitConfig) {
  // directory to output the file
  const directory = circuitConfig.dir || 'test';

  // generate the main component code using the template
  const ejsPath = './circuits/ejs/template.circom';

  // add "../" to the filename in include, one for each "/" in directory name
  // if none, the prefix becomes empty string
  const filePrefix = '../'.repeat((directory.match(/\//g) || []).length);

  const circuit = ejs.render(readFileSync(ejsPath).toString(), {
    pubs: circuitConfig.pubs || [],
    params: circuitConfig.params || [],
    template: circuitConfig.template,
    file: filePrefix + circuitConfig.file,
  });

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

if (require.main === module) {
  // when directly called, we require a circuit name as the argument
  // this circuit should be present in `circuit.config.ts`
  const name = process.argv[2];
  if (process.argv.length !== 3) {
    throw new Error('Please provide the circuit name.');
  }
  if (!(name in config)) {
    throw new Error(`Target ${name} not found in circuit.config.cjs`);
  }
  instantiate(name, {
    ...config[name],
    dir: 'main',
  });
}
