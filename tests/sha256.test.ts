import {expect} from 'chai';
import {WasmTester} from '../src';
import {randomBytes, createHash} from 'crypto';

describe('sha256', () => {
  let circuit: WasmTester<['in'], ['out']>;

  const NUM_BYTES = 36;
  const BYTES = randomBytes(NUM_BYTES);
  const LOCAL_HASH = createHash('sha256').update(BYTES).digest('hex');
  const INPUT = {
    in: BYTES.toJSON().data,
  };

  before(async () => {
    circuit = await WasmTester.new('sha256', {
      file: 'sha256',
      template: 'Sha256Bytes',
      params: [NUM_BYTES],
    });
    await circuit.checkConstraintCount();
  });

  it('should compute hash correctly', async () => {
    const {out} = await circuit.compute(INPUT, ['out']);
    const outputBytes = (out as bigint[]).map(b => parseInt(b.toString()));
    const outputHex = Buffer.from(outputBytes).toString('hex');
    expect(outputHex).to.eq(LOCAL_HASH);
  });
});
