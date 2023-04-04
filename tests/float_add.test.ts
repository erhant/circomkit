import {instantiate} from '../utils/instantiate';
import {createWasmTester} from '../utils/wasmTester';

// tests adapted from https://github.com/rdi-berkeley/zkp-mooc-lab
describe('fp32', () => {
  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    instantiate('fp32', 'test', {
      file: 'float_add',
      template: 'FloatAdd',
      publicInputs: [],
      templateParams: [8, 23],
    });
    circuit = await createWasmTester('fp32', 'test');
    await circuit.printConstraintCount(401);
  });

  it('case I test', async () => {
    await circuit.expectCorrectAssert(
      {
        e: ['43', '5'],
        m: ['11672136', '10566265'],
      },
      {e_out: '43', m_out: '11672136'}
    );
  });

  it('case II test 1', async () => {
    await circuit.expectCorrectAssert(
      {
        e: ['104', '106'],
        m: ['12444445', '14159003'],
      },
      {e_out: '107', m_out: '8635057'}
    );
  });

  it('case II test 2', async () => {
    await circuit.expectCorrectAssert(
      {
        e: ['176', '152'],
        m: ['16777215', '16777215'],
      },
      {e_out: '177', m_out: '8388608'}
    );
  });

  it('case II test 3', async () => {
    await circuit.expectCorrectAssert(
      {
        e: ['142', '142'],
        m: ['13291872', '13291872'],
      },
      {e_out: '143', m_out: '13291872'}
    );
  });

  it('one input zero test', async () => {
    await circuit.expectCorrectAssert(
      {
        e: ['0', '43'],
        m: ['0', '10566265'],
      },
      {e_out: '43', m_out: '10566265'}
    );
  });

  it('both inputs zero test', async () => {
    await circuit.expectCorrectAssert(
      {
        e: ['0', '0'],
        m: ['0', '0'],
      },
      {e_out: '0', m_out: '0'}
    );
  });

  it('should fail - exponent zero but mantissa non-zero', async () => {
    await circuit.expectFailedAssert({
      e: ['0', '0'],
      m: ['0', '10566265'],
    });
  });

  it('should fail - mantissa >= 2^{p+1}', async () => {
    await circuit.expectFailedAssert({
      e: ['0', '43'],
      m: ['0', '16777216'],
    });
  });

  it('should fail - mantissa < 2^{p}', async () => {
    await circuit.expectFailedAssert({
      e: ['0', '43'],
      m: ['0', '6777216'],
    });
  });

  it('should fail - exponent >= 2^k', async () => {
    await circuit.expectFailedAssert({
      e: ['0', '256'],
      m: ['0', '10566265'],
    });
  });
});

describe('fp64', () => {
  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    instantiate('fp64', 'test', {
      file: 'float_add',
      template: 'FloatAdd',
      publicInputs: [],
      templateParams: [11, 52],
    });
    circuit = await createWasmTester('fp64', 'test');
    await circuit.printConstraintCount(819);
  });

  it('case I test', async () => {
    await circuit.expectCorrectAssert(
      {
        e: ['1122', '1024'],
        m: ['7807742059002284', '7045130465601185'],
      },
      {e_out: '1122', m_out: '7807742059002284'}
    );
  });

  it('case II test 1', async () => {
    await circuit.expectCorrectAssert(
      {
        e: ['1056', '1053'],
        m: ['8879495032259305', '5030141535601637'],
      },
      {e_out: '1057', m_out: '4754131362104755'}
    );
  });

  it('case II test 2', async () => {
    await circuit.expectCorrectAssert(
      {
        e: ['1035', '982'],
        m: ['4804509148660890', '8505192799372177'],
      },
      {e_out: '1035', m_out: '4804509148660891'}
    );
  });

  it('case II test 3', async () => {
    await circuit.expectCorrectAssert(
      {
        e: ['982', '982'],
        m: ['8505192799372177', '8505192799372177'],
      },
      {e_out: '983', m_out: '8505192799372177'}
    );
  });

  it('one input zero test', async () => {
    await circuit.expectCorrectAssert(
      {
        e: ['0', '982'],
        m: ['0', '8505192799372177'],
      },
      {e_out: '982', m_out: '8505192799372177'}
    );
  });

  it('both inputs zero test', async () => {
    await circuit.expectCorrectAssert(
      {
        e: ['0', '0'],
        m: ['0', '0'],
      },
      {e_out: '0', m_out: '0'}
    );
  });

  it('should fail - exponent zero but mantissa non-zero', async () => {
    await circuit.expectFailedAssert({
      e: ['0', '0'],
      m: ['0', '8505192799372177'],
    });
  });

  it('should fail - mantissa < 2^{p}', async () => {
    await circuit.expectFailedAssert({
      e: ['0', '43'],
      m: ['0', '16777216'],
    });
  });
});
