import { describe, it, beforeAll } from 'bun:test';
import { WitnessTester } from 'circomkit';
import { createHash } from 'crypto';
import { Circomkit } from 'circomkit';

const circomkit = new Circomkit({
  verbose: false,
});

describe('sha256', () => {
  let circuit: WitnessTester<['in'], ['out']>;

  // number of bytes for the sha256 input
  const NUM_BYTES = 36;

  // preimage and its byte array
  const PREIMAGE = Buffer.from('today is a good day, not everyday is');
  const PREIMAGE_BYTES = PREIMAGE.toJSON().data;

  // digest and its byte array
  const DIGEST = createHash('sha256').update(new Uint8Array(PREIMAGE)).digest('hex');
  const DIGEST_BYTES = Buffer.from(DIGEST, 'hex').toJSON().data;

  // circuit signals
  const INPUT = {
    in: PREIMAGE_BYTES,
  };
  const OUTPUT = {
    out: DIGEST_BYTES,
  };

  beforeAll(async () => {
    circuit = await circomkit.WitnessTester(`sha256_${NUM_BYTES}`, {
      file: 'sha256',
      template: 'Sha256Bytes',
      params: [NUM_BYTES],
    });
  });

  it('should compute hash correctly', async () => {
    await circuit.expectPass(INPUT, OUTPUT);
  });
});
