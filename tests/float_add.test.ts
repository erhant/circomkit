import WasmTester from '../src/wasmTester';

// tests adapted from https://github.com/rdi-berkeley/zkp-mooc-lab

const expectedConstraints = {
  fp32: 401,
  fp64: 819,
  checkBitLength: (bits: number) => bits + 2,
  leftShift: (shiftBound: number) => shiftBound + 2,
  right: (bits: number) => bits + 2,
  normalize: (P: number) => 3 * P + 1 + 1, // MSNZB + 1
  msnzb: (bits: number) => 3 * bits + 1,
};

describe('float_add 32-bit', () => {
  let circuit: WasmTester<['e', 'm'], ['e_out', 'm_out']>;

  const k = 8;
  const p = 23;

  before(async () => {
    circuit = await WasmTester.new('fp32', {
      file: 'float_add',
      template: 'FloatAdd',
      params: [k, p],
    });
    await circuit.checkConstraintCount(401);
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

  it('should fail - mantissa ≥ 2^(p+1)', async () => {
    await circuit.expectFailedAssert({
      e: ['0', '43'],
      m: ['0', '16777216'],
    });
  });

  it('should fail - mantissa < 2^p', async () => {
    await circuit.expectFailedAssert({
      e: ['0', '43'],
      m: ['0', '6777216'],
    });
  });

  it('should fail - exponent ≥ 2^k', async () => {
    await circuit.expectFailedAssert({
      e: ['0', '256'],
      m: ['0', '10566265'],
    });
  });
});

describe('float_add 64-bit', () => {
  const k = 11;
  const p = 52;
  let circuit: WasmTester<['e', 'm'], ['e_out', 'm_out']>;

  before(async () => {
    circuit = await WasmTester.new('fp64', {
      file: 'float_add',
      template: 'FloatAdd',
      params: [k, p],
    });
    await circuit.checkConstraintCount(819);
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

  it('should fail - mantissa < 2^p', async () => {
    await circuit.expectFailedAssert({
      e: ['0', '43'],
      m: ['0', '16777216'],
    });
  });
});

describe('float_add utilities', () => {
  describe('check bit length', () => {
    const b = 23; // bit count
    let circuit: WasmTester<['in'], ['out']>;

    before(async () => {
      circuit = await WasmTester.new(`cbl_${b}`, {
        file: 'float_add',
        template: 'CheckBitLength',
        params: [b],
        dir: 'test/float_add',
      });
      await circuit.checkConstraintCount(expectedConstraints.checkBitLength(b));
    });

    it('should give 1 for in ≤ b', async () => {
      await circuit.expectCorrectAssert(
        {
          in: '4903265',
        },
        {out: '1'}
      );
    });

    it('should give 0 for in > b', async () => {
      await circuit.expectCorrectAssert(
        {
          in: '13291873',
        },
        {out: '0'}
      );
    });
  });

  describe('left shift', () => {
    const shift_bound = 25;
    let circuit: WasmTester<['x', 'shift', 'skip_checks'], ['y']>;

    before(async () => {
      circuit = await WasmTester.new(`shl_${shift_bound}`, {
        file: 'float_add',
        template: 'LeftShift',
        dir: 'test/float_add',
        params: [shift_bound],
      });
      await circuit.checkConstraintCount(expectedConstraints.leftShift(shift_bound));
    });

    it("should pass test 1 - don't skip checks", async () => {
      await circuit.expectCorrectAssert(
        {
          x: '65',
          shift: '24',
          skip_checks: '0',
        },
        {y: '1090519040'}
      );
    });

    it("should pass test 2 - don't skip checks", async () => {
      await circuit.expectCorrectAssert(
        {
          x: '65',
          shift: '0',
          skip_checks: '0',
        },
        {y: '65'}
      );
    });

    it("should fail - don't skip checks", async () => {
      await circuit.expectFailedAssert({
        x: '65',
        shift: '25',
        skip_checks: '0',
      });
    });

    it('should pass when skip_checks = 1 and shift is ≥ shift_bound', async () => {
      await circuit.expectCorrectAssert({
        x: '65',
        shift: '25',
        skip_checks: '1',
      });
    });
  });

  describe('right shift', () => {
    const b = 49;
    const shift = 24;
    let circuit: WasmTester<['x'], ['y']>;

    before(async () => {
      circuit = await WasmTester.new(`shr_${b}`, {
        file: 'float_add',
        template: 'RightShift',
        dir: 'test/float_add',
        params: [b, shift],
      });
      await circuit.checkConstraintCount(b);
    });

    it('should pass - small bitwidth', async () => {
      await circuit.expectCorrectAssert(
        {
          x: '82263136010365',
        },
        {y: '4903265'}
      );
    });

    it('should fail - large bitwidth', async () => {
      await circuit.expectFailedAssert({
        x: '15087340228765024367',
      });
    });
  });

  describe('normalize', () => {
    const k = 8;
    const p = 23;
    const P = 47;
    let circuit: WasmTester<['e', 'm', 'skip_checks'], ['e_out', 'm_out']>;

    before(async () => {
      circuit = await WasmTester.new(`normalize_${k}_${p}_${P}`, {
        file: 'float_add',
        template: 'Normalize',
        params: [k, p, P],
        dir: 'test/float_add',
      });
      await circuit.checkConstraintCount(expectedConstraints.normalize(P));
    });

    it("should pass - don't skip checks", async () => {
      await circuit.expectCorrectAssert(
        {
          e: '100',
          m: '20565784002591',
          skip_checks: '0',
        },
        {e_out: '121', m_out: '164526272020728'}
      );
    });

    it("should pass - already normalized and don't skip checks", async () => {
      await circuit.expectCorrectAssert(
        {
          e: '100',
          m: '164526272020728',
          skip_checks: '0',
        },
        {e_out: '124', m_out: '164526272020728'}
      );
    });

    it("should fail when m = 0 - don't skip checks", async () => {
      await circuit.expectFailedAssert({
        e: '100',
        m: '0',
        skip_checks: '0',
      });
    });

    it('should pass when skip_checks = 1 and m is 0', async () => {
      await circuit.expectCorrectAssert({
        e: '100',
        m: '0',
        skip_checks: '1',
      });
    });
  });

  describe('msnzb', () => {
    const b = 48;
    let circuit: WasmTester<['in', 'skip_checks'], ['one_hot']>;

    before(async () => {
      circuit = await WasmTester.new(`msnzb_${b}`, {
        file: 'float_add',
        template: 'MSNZB',
        dir: 'test/float_add',
        params: [b],
      });
      await circuit.checkConstraintCount(expectedConstraints.msnzb(b));
    });

    it("should pass test 1 - don't skip checks", async () => {
      await circuit.expectCorrectAssert(
        {
          in: '1',
          skip_checks: '0',
        },
        {
          // prettier-ignore
          one_hot: ['1', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
        }
      );
    });

    it("should pass test 2 - don't skip checks", async () => {
      await circuit.expectCorrectAssert(
        {
          in: '281474976710655',
          skip_checks: '0',
        },
        {
          // prettier-ignore
          one_hot: ['0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '1'],
        }
      );
    });

    it("should fail when in = 0 - don't skip checks", async () => {
      await circuit.expectFailedAssert({
        in: '0',
        skip_checks: '0',
      });
    });

    it('should pass when skip_checks = 1 and in is 0', async () => {
      await circuit.expectCorrectAssert({
        in: '0',
        skip_checks: '1',
      });
    });
  });
});
