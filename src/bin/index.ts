#!/usr/bin/env node
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';
import {Circomkit} from '../circomkit';
import {initFiles, postInitString, usageString} from '../utils';
import {prettyStringify} from '../utils';

const CONFIG_PATH = './circomkit.json';
const DEFAULT_INPUT = 'default';

async function cli(): Promise<number> {
  // read user configs & override if there are any
  let config = {};
  if (existsSync(CONFIG_PATH)) {
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  }
  const circomkit = new Circomkit(config);

  // smol utility function to print pretty titles in the same format
  const titleLog = (title: string) => circomkit.log(`===| ${title} |===`, 'title');

  // execute command
  type Commands = keyof Circomkit | 'init' | 'config';
  switch (process.argv[2] as unknown as Commands) {
    case 'compile': {
      titleLog('Compiling the circuit');
      const path = await circomkit.compile(process.argv[3]);
      circomkit.log('Built at: ' + path, 'success');
      break;
    }

    case 'instantiate': {
      titleLog('Creating main component');
      const path = circomkit.instantiate(process.argv[3]);
      circomkit.log('Created at: ' + path, 'success');
      break;
    }

    case 'clean': {
      titleLog('Cleaning artifacts');
      await circomkit.clean(process.argv[3]);
      circomkit.log('Cleaned.', 'success');
      break;
    }

    case 'json': {
      titleLog('Exporting JSON file');
      const {json, path} = await circomkit.json(
        process.argv[3] as 'r1cs' | 'zkey' | 'wtns',
        process.argv[4],
        process.argv[5]
      );
      writeFileSync(path, prettyStringify(json));
      circomkit.log('Exported at: ' + path, 'success');
      break;
    }

    case 'info': {
      titleLog('Circuit information');
      const info = await circomkit.info(process.argv[3]);
      circomkit.log(`Prime Field: ${info.primeName}`);
      circomkit.log(`Number of of Wires: ${info.variables}`);
      circomkit.log(`Number of Constraints: ${info.constraints}`);
      circomkit.log(`Number of Private Inputs: ${info.privateInputs}`);
      circomkit.log(`Number of Public Inputs: ${info.publicInputs}`);
      circomkit.log(`Number of Labels: ${info.labels}`);
      circomkit.log(`Number of Outputs: ${info.outputs}`);
      break;
    }

    case 'contract': {
      titleLog('Exporting contract');
      const path = await circomkit.contract(process.argv[3]);
      circomkit.log('Created at: ' + path, 'success');
      break;
    }

    case 'calldata': {
      titleLog('Printing calldata');
      const calldata = await circomkit.calldata(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      circomkit.log(calldata);
      break;
    }

    case 'prove': {
      titleLog('Generating proof');
      const path = await circomkit.prove(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      circomkit.log('Generated at: ' + path, 'success');
      break;
    }

    case 'ptau': {
      titleLog('Retrieving PTAU');
      const path = await circomkit.ptau(process.argv[3]);
      circomkit.log('PTAU ready at: ' + path, 'success');
      break;
    }

    case 'verify': {
      titleLog('Verifying proof');
      const result = await circomkit.verify(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      if (result) {
        circomkit.log('Verification successful.', 'success');
      } else {
        circomkit.log('Verification failed!', 'error');
      }
      break;
    }

    case 'witness': {
      titleLog('Calculating witness');
      const path = await circomkit.witness(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      circomkit.log('Witness created: ' + path, 'success');
      break;
    }

    case 'setup': {
      titleLog('Circuit-specific setup');
      const paths = await circomkit.setup(process.argv[3]);
      circomkit.log('Prover key created: ' + paths.proverKeyPath, 'success');
      circomkit.log('Verifier key created: ' + paths.verifierKeyPath, 'success');
      break;
    }

    case 'config': {
      titleLog('Circomkit Configuration');
      console.log(circomkit.config);
      break;
    }

    case 'init': {
      titleLog('Initializing project');
      const baseDir = process.argv[3] || '.';
      await Promise.all(
        Object.values(initFiles).map(item => {
          const path = `${baseDir}/${item.dir}/${item.name}`;
          if (!existsSync(path)) {
            mkdirSync(`${baseDir}/${item.dir}`, {recursive: true});
            writeFileSync(path, item.content);
            circomkit.log('Created: ' + path);
          } else {
            circomkit.log(path + ' exists, skipping.', 'error');
          }
        })
      );

      circomkit.log('Circomkit project initialized! ✨', 'success');
      circomkit.log(postInitString);
      break;
    }

    default:
      console.log(usageString);
      return 1;
  }

  return 0;
}

/**
 * We have to exit forcefully, as SnarkJS CLI does too.
 * In their code, each function returns a code, with the
 * succesfull ones returning 0. If an error is thrown,
 * that error is logged and process is exited with error code 1.
 *
 * See line 312 in snarkjs/circomkit.js
 */
function exit(code: number) {
  // eslint-disable-next-line no-process-exit
  process.exit(code);
}

cli()
  .then(exit)
  .catch(err => {
    console.error(err);
    exit(1);
  });
