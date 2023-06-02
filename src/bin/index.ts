#!/usr/bin/env node
import {Circomkit} from '../circomkit';

const DEFAULT_INPUT = 'default';
const DEFAULT_PTAU = './ptau/powersOfTau28_hez_final_12.ptau';

async function cli(): Promise<number> {
  const circomkit = new Circomkit();
  switch (process.argv[2] as unknown as keyof Circomkit) {
    case 'compile':
      await circomkit.compile(process.argv[3]);
      break;
    case 'instantiate':
      circomkit.instantiate(process.argv[3]);
      break;
    case 'clean':
      await circomkit.clean(process.argv[3]);
      break;
    // case 'type':
    //   await circomkit.type(process.argv[3]);
    //   break;
    case 'contract':
      await circomkit.contract(process.argv[3]);
      break;
    // case 'calldata':
    //   await circomkit.calldata(process.argv[3]);
    //   break;
    case 'prove':
      await circomkit.prove(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      break;
    case 'verify':
      await circomkit.verify(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      break;
    case 'witness':
      await circomkit.witness(process.argv[3], process.argv[4] || DEFAULT_INPUT);
      break;
    case 'setup':
      await circomkit.setup(process.argv[3], process.argv[4] || DEFAULT_PTAU);
      break;
    default:
      console.error('Invalid command.');
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
