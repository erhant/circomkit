#!/usr/bin/env node
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs';
import {Circomkit} from '../circomkit';
import {initFiles} from '../utils/init';

const CONFIG_PATH = './circomkit.json';
const DEFAULT_INPUT = 'default';
const DEFAULT_PTAU = './ptau/powersOfTau28_hez_final_12.ptau';
const USAGE = `Usage:

  Compile the circuit.
    compile circuit

  Create main component.
    instantiate circuit

  Clean build artifacts & main.
    clean circuit

  Export Solidity verifier.
    contract circuit

  Generate a proof.
    prove circuit input 

  Verify a proof.
    verify circuit input

  Generate a witness.
    witness circuit input
  
  Circuit-specific setup.
    setup circuit input
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

    // case 'type': // TODO
    //   await circomkit.type(process.argv[3]);
    //   break;

    case 'contract': {
      circomkit.log('=== Generating verifier contract ===', 'title');
      const path = await circomkit.contract(process.argv[3]);
      circomkit.log('Created at: ' + path);
      break;
    }

    // case 'calldata': // // TODO
    //   await circomkit.calldata(process.argv[3]);
    //   break;

    case 'prove': {
      circomkit.log('=== Generating proof ===', 'title');
      const path = await circomkit.prove(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      circomkit.log('Generated under: ' + path);
      break;
    }

    case 'verify': {
      circomkit.log('=== Verifying proof ===', 'title');
      const result = await circomkit.verify(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      if (result) {
        circomkit.log('Verification successful.', 'log');
      } else {
        circomkit.log('Verification failed!', 'error');
      }
      break;
    }

    case 'witness': {
      circomkit.log('=== Calculating witness ===', 'title');
      const path = await circomkit.witness(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      circomkit.log('Witness created: ' + path);
      break;
    }

    case 'setup': {
      circomkit.log('=== Circuit-specific setup ===', 'title');
      const path = await circomkit.setup(process.argv[3], process.argv[4] || DEFAULT_PTAU);
      circomkit.log('Prover key created: ' + path);
      break;
    }

    case 'init': {
      await Promise.all(
        [initFiles.circuit, initFiles.circuits, initFiles.input, initFiles.tests].map(item => {
          const path = `${item.dir}/${item.name}`;
          if (!existsSync(path)) {
            mkdirSync(item.dir, {recursive: true});
            writeFileSync(path, item.content);
          } else {
            circomkit.log(path + ' exists, skipping.', 'error');
          }
        })
      );
      break;
    }
    // setup project structure

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
