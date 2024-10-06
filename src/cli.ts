#!/usr/bin/env node
import {Command} from '@commander-js/extra-typings';
import {Circomkit} from './core';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'fs';
import {prettyStringify} from './utils';
import {exec} from 'child_process';
import {teardown} from './utils/teardown';

const CONFIG_PATH = './circomkit.json';

function cli(args: string[]) {
  const circomkit = new Circomkit(existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) : {});

  ///////////////////////////////////////////////////////////////////////////////
  const circuit = new Command('compile')
    .description('compile the circuit')
    .argument('<circuit>', 'Circuit name')
    // .hook('preAction', () => titleLog('Compiling the circuit'))
    .action(async circuit => {
      const path = await circomkit.compile(circuit);
      circomkit.log.info('Built at:', path);

      // TODO: pattern matching https://github.com/erhant/circomkit/issues/79
    });

  ///////////////////////////////////////////////////////////////////////////////
  const instantiate = new Command('instantiate')
    .description('create the main component')
    .argument('<circuit>', 'Circuit name')
    .action(async circuit => {
      const path = circomkit.instantiate(circuit);
      circomkit.log.info('Created at:', path);
    });

  ///////////////////////////////////////////////////////////////////////////////
  const info = new Command('info')
    .description('print circuit information')
    .argument('<circuit>', 'Circuit name')
    .action(async circuit => {
      const info = await circomkit.info(circuit);
      console.log(`Prime Field: ${info.primeName}`);
      console.log(`Number of Wires: ${info.wires}`);
      console.log(`Number of Constraints: ${info.constraints}`);
      console.log(`Number of Private Inputs: ${info.privateInputs}`);
      console.log(`Number of Public Inputs: ${info.publicInputs}`);
      console.log(`Number of Public Outputs: ${info.publicOutputs}`);
      console.log(`Number of Labels: ${info.labels}`);
    });

  ///////////////////////////////////////////////////////////////////////////////
  const clear = new Command('clear')
    .description('clear circuit build artifacts')
    .argument('<circuit>', 'Circuit name')
    .action(async circuit => {
      await circomkit.clear(circuit);
      circomkit.log.info('Cleaned.');
    });

  ///////////////////////////////////////////////////////////////////////////////
  const init = new Command('init')
    .description('initialize a new Circomkit project')
    .argument('[dir]', 'Directory')
    .action(async dir => {
      const cmd = `git clone https://github.com/erhant/circomkit-examples.git ${dir ?? '.'}`;
      circomkit.log.info(cmd);

      const result = await new Promise<{stdout: string; stderr: string}>((resolve, reject) =>
        exec(cmd, (error, stdout, stderr) => (error ? reject(error) : resolve({stdout, stderr})))
      );

      circomkit.log.info(result.stdout);
      if (result.stderr) {
        circomkit.log.info(result.stderr);
      }

      circomkit.log.info('Circomkit project initialized! ✨');
    });

  ///////////////////////////////////////////////////////////////////////////////

  // TODO: add -p / --print option to print JSON without saving it
  const json = new Command('json')
    .description('export JSON files')
    .addCommand(
      new Command('r1cs')
        .description('export r1cs')
        .argument('<circuit>', 'Circuit name')
        .action(async circuit => {
          const {json, path} = await circomkit.json('r1cs', circuit);
          writeFileSync(path, prettyStringify(json));
          circomkit.log.info('Exported R1CS at: ' + path);
        })
    )
    .addCommand(
      new Command('zkey')
        .description('export prover key')
        .argument('<circuit>', 'Circuit name')
        .action(async circuit => {
          const {json, path} = await circomkit.json('zkey', circuit);
          writeFileSync(path, prettyStringify(json));
          circomkit.log.info('Exported prover key at: ' + path);
        })
    )
    .addCommand(
      new Command('wtns')
        .description('export witness')
        .argument('<circuit>', 'Circuit name')
        .argument('<input>', 'Input name')
        .action(async (circuit, input) => {
          const {json, path} = await circomkit.json('wtns', circuit, input);
          writeFileSync(path, prettyStringify(json));
          circomkit.log.info('Exported prover key at: ' + path);
        })
    );

  ///////////////////////////////////////////////////////////////////////////////
  const contract = new Command('contract')
    .description('export Solidity verifier contract')
    .argument('<circuit>', 'Circuit name')
    .action(async circuit => {
      const path = await circomkit.contract(circuit);
      circomkit.log.info('Created at: ' + path);
    });

  ///////////////////////////////////////////////////////////////////////////////
  const calldata = new Command('calldata')
    .description('export calldata for a verifier contract')
    .argument('<circuit>', 'Circuit name')
    .argument('<input>', 'Input name')
    .action(async (circuit, input) => {
      const calldata = await circomkit.calldata(circuit, input);
      circomkit.log.info(calldata);
    });

  ///////////////////////////////////////////////////////////////////////////////
  const vkey = new Command('vkey')
    .description('extract verification key')
    .argument('<circuit>', 'Circuit name')
    .argument('[pkeyPath]', 'Prover key path')
    .action(async (circuit, pkeyPath) => {
      const path = await circomkit.vkey(circuit, pkeyPath);
      circomkit.log.info('Created at: ' + path);
    });

  ///////////////////////////////////////////////////////////////////////////////
  const prove = new Command('prove')
    .description('generate zk-proof')
    .argument('<circuit>', 'Circuit name')
    .argument('<input>', 'Input name')
    .action(async (circuit, input) => {
      const path = await circomkit.prove(circuit, input);
      circomkit.log.info('Generated at: ' + path);
    });

  ///////////////////////////////////////////////////////////////////////////////
  const verify = new Command('verify')
    .description('verify zk-proof')
    .argument('<circuit>', 'Circuit name')
    .argument('<input>', 'Input name')
    .action(async (circuit, input) => {
      const ok = await circomkit.verify(circuit, input);
      if (ok) {
        circomkit.log.info('Verification successful.');
      } else {
        circomkit.log.info('Verification failed!');
      }
    });

  ///////////////////////////////////////////////////////////////////////////////
  const witness = new Command('witness')
    .description('compute witness')
    .argument('<circuit>', 'Circuit name')
    .argument('<input>', 'Input name')
    .action(async (circuit, input) => {
      const path = await circomkit.witness(circuit, input);
      circomkit.log.info('Witness created: ' + path);
    });

  ///////////////////////////////////////////////////////////////////////////////
  const setup = new Command('setup')
    .description('commence circuit-specific setup')
    .argument('<circuit>', 'Circuit name')
    .argument('[ptauPath]', 'Path to PTAU')
    .action(async (circuit, ptauPath) => {
      const {proverKeyPath, verifierKeyPath} = await circomkit.setup(circuit, ptauPath);
      circomkit.log.info('Prover key created: ' + proverKeyPath);
      circomkit.log.info('Verifier key created: ' + verifierKeyPath);
    });

  ///////////////////////////////////////////////////////////////////////////////
  const ptau = new Command('ptau')
    .description('download PTAU file')
    .argument('<circuit>', 'Circuit name')
    .action(async circuit => {
      const path = await circomkit.ptau(circuit);
      circomkit.log.info('PTAU ready at: ' + path);
    });

  ///////////////////////////////////////////////////////////////////////////////
  const list = new Command('list').description('list circuits & instances').action(async () => {
    const templates = readdirSync(circomkit.config.dirCircuits)
      .filter(path => path.endsWith('.circom'))
      .map(path => path.slice(0, -'.circom'.length));
    circomkit.log.info(
      `Template Files (${circomkit.config.dirCircuits}):\n` + templates.map((c, i) => `  ${i + 1}. ${c}`).join('\n')
    );

    const circuits = circomkit.readCircuits();
    circomkit.log.info(
      `\nCircuit Names (${circomkit.config.circuits}):\n` +
        Object.keys(circuits)
          .map((c, i) => `  ${i + 1}. ${c}`)
          .join('\n')
    );
  });

  ///////////////////////////////////////////////////////////////////////////////
  const config = new Command('config').description('print configuration').action(() => {
    circomkit.log.info(circomkit.config);
  });

  ///////////////////////////////////////////////////////////////////////////////
  new Command()
    .name('circomkit')
    .description('Circom testing & development toolkit')
    // none
    .addCommand(init)
    .addCommand(config)
    .addCommand(list)
    .addCommand(json)
    // <circuit>
    .addCommand(circuit)
    .addCommand(instantiate)
    .addCommand(info)
    .addCommand(clear)
    .addCommand(contract)
    .addCommand(vkey)
    .addCommand(ptau)
    .addCommand(setup)
    // <circuit> <input>
    .addCommand(prove)
    .addCommand(witness)
    .addCommand(verify)
    .addCommand(calldata)
    // teardown to terminate SnarkJS, otherwise hangs the program
    .hook('postAction', () => teardown())
    .parse(args);

  // TODO: test graceful exits
  /**
   * We have to exit forcefully, as SnarkJS CLI does too.
   * In their code, each function returns a code, with the
   * succesfull ones returning 0. If an error is thrown,
   * that error is logged and process is exited with error code 1.
   *
   * See https://github.com/iden3/snarkjs/blob/master/cli.js#L348
   */
  // function exit(code: number) {
  //   // eslint-disable-next-line no-process-exit
  //   process.exit(code);
  // }

  // cli()
  //   .then(code => exit(code))
  //   .catch(err => {
  //     console.error(err);
  //     exit(1);
  //   });
}

cli(process.argv);
