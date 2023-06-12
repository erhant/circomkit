#!/usr/bin/env node
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';
import {Circomkit} from '../circomkit';
import {initFiles} from '../utils/initFiles';

const CONFIG_PATH = './circomkit.json';
const DEFAULT_INPUT = 'default';
const USAGE = `Usage:

  Compile the circuit.
    compile circuit

  Create main component.
    instantiate circuit

  Clean build artifacts & main component.
    clean circuit

  Export Solidity verifier.
    contract circuit
  
  Commence circuit-specific setup.
    setup circuit [ptau-path]
  
  Download the PTAU file needed for the circuit.
    ptau circuit
  
  Export calldata for a verifier contract.
    contract circuit input

  Generate a proof.
    prove circuit input 

  Verify a proof.
    verify circuit input

  Generate a witness.
    witness circuit input
  
  Initialize a Circomkit project.
    init [name]
`;

async function cli(): Promise<number> {
  // read user configs
  let config = {};
  if (existsSync(CONFIG_PATH)) {
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  }
  const circomkit = new Circomkit(config);

  // execute command
  switch (process.argv[2] as unknown as keyof Circomkit | 'init') {
    case 'compile': {
      circomkit.log('\n=== Compiling the circuit ===', 'title');
      const path = await circomkit.compile(process.argv[3]);
      circomkit.log('Built at: ' + path);
      break;
    }

    case 'instantiate': {
      circomkit.log('\n=== Creating main component ===', 'title');
      const path = circomkit.instantiate(process.argv[3]);
      circomkit.log('Created at: ' + path);
      break;
    }

    case 'clean': {
      circomkit.log('\n=== Cleaning artifacts ===', 'title');
      await circomkit.clean(process.argv[3]);
      circomkit.log('Cleaned.');
      break;
    }

    case 'info': {
      circomkit.log('\n=== Circuit information ===', 'title');
      const info = await circomkit.info(process.argv[3]);
      circomkit.log(`Number of of Wires: ${info.variables}`);
      circomkit.log(`Number of Constraints: ${info.constraints}`);
      circomkit.log(`Number of Private Inputs: ${info.privateInputs}`);
      circomkit.log(`Number of Public Inputs: ${info.publicInputs}`);
      circomkit.log(`Number of Labels: ${info.labels}`);
      circomkit.log(`Number of Outputs: ${info.outputs}`);
      break;
    }

    case 'contract': {
      circomkit.log('\n=== Exporting contract ===', 'title');
      const path = await circomkit.contract(process.argv[3]);
      circomkit.log('Created at: ' + path);
      break;
    }

    case 'calldata': {
      circomkit.log('\n=== Exporting contract ===', 'title');
      const calldata = await circomkit.calldata(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      circomkit.log('Calldata printed:', 'success');
      circomkit.log(calldata);
      break;
    }

    case 'prove': {
      circomkit.log('\n=== Generating proof ===', 'title');
      const path = await circomkit.prove(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      circomkit.log('Generated at: ' + path);
      break;
    }

    case 'ptau': {
      circomkit.log('\n=== Retrieving PTAU ===', 'title');
      const path = await circomkit.ptau(process.argv[3]);
      circomkit.log('PTAU ready at: ' + path);
      break;
    }

    case 'verify': {
      circomkit.log('\n=== Verifying proof ===', 'title');
      const result = await circomkit.verify(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      if (result) {
        circomkit.log('Verification successful.', 'success');
      } else {
        circomkit.log('Verification failed!', 'error');
      }
      break;
    }

    case 'witness': {
      circomkit.log('\n=== Calculating witness ===', 'title');
      const path = await circomkit.witness(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      circomkit.log('Witness created: ' + path);
      break;
    }

    case 'setup': {
      circomkit.log('\n=== Circuit-specific setup ===', 'title');
      const path = await circomkit.setup(process.argv[3]);
      circomkit.log('Prover key created: ' + path);
      break;
    }

    case 'init': {
      circomkit.log('\n=== Initializing project ===', 'title');
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

      circomkit.log('Circomkit project created!', 'success');
      break;
    }

    default:
      console.log(USAGE);
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
