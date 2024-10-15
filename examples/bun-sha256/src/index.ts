import { createHash } from 'crypto';
import { Circomkit } from 'circomkit';

const PREIMAGE = Buffer.from('bunsbunsbunsbunsbuns');
const PREIMAGE_BYTES = PREIMAGE.toJSON().data;

// digest and its byte array
const DIGEST = createHash('sha256').update(new Uint8Array(PREIMAGE)).digest('hex');
const DIGEST_BYTES = Buffer.from(DIGEST, 'hex').toJSON().data;

const circomkit = new Circomkit({
  inspect: false,
});
const circuitName = `sha256_${PREIMAGE_BYTES.length}`;

console.info('Building circuit...');
const buildPath = await circomkit.compile(circuitName, {
  file: 'sha256',
  template: 'Sha256Bytes',
  params: [PREIMAGE_BYTES.length],
});
console.info(`Compiled circuit to ${buildPath}`);

console.info('Creating a witness...');
const witnessPath = await circomkit.witness(circuitName, 'bunsbuns', {
  in: PREIMAGE_BYTES,
});
console.info(`Witness created at ${witnessPath}`);

// // https://github.com/oven-sh/bun/issues/11005
// // https://github.com/iden3/snarkjs/pull/490
// // Cant prove with Bun yet!
// console.info('Running prover...');
// const proofPath = await circomkit.prove(circuitName, 'bunsbuns', {
//   in: PREIMAGE_BYTES,
// });
// console.info('Done!');
