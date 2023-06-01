#!/usr/bin/env node

import {Circomkit} from '../cli/';

async function main() {
  const cli = new Circomkit();

  // parse commands & arguments

  // await cli.prove('multiplier_3', 'default');
  // await cli.verify('multiplier_3', 'default');
  await cli.witness('multiplier_3', 'default');

  // cli.clean('multiplier_3');
  // cli.instantiate('multiplier_3');
  // await cli.compile('multiplier_3');
  /**
   * We have to exit forcefully, as SnarkJS CLI does
   * too. In their code, each function returns a code,
   * with the succesfull ones returning 0. If an error is
   * thrown, that error is logged and process is exited
   * with error code 1.
   *
   * See line 312 in snarkjs/cli.js
   */
  // eslint-disable-next-line no-process-exit
  process.exit(0);
}

main();
