import {instantiate} from '../utils/instantiate';
import {createWasmTester} from '../utils/wasmTester';

// tests adapted from https://github.com/rdi-berkeley/zkp-mooc-lab
describe('float_add 32-bit', () => {
  const k = 8;
  const p = 23;
  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    instantiate('fp32', 'test', {
      file: 'float_add',
      template: 'FloatAdd',
      publicInputs: [],
      templateParams: [k, p],
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

describe('float_add 64-bit', () => {
  const k = 11;
  const p = 52;
  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    instantiate('fp64', 'test', {
      file: 'float_add',
      template: 'FloatAdd',
      publicInputs: [],
      templateParams: [k, p],
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

describe('float_add utilities', () => {
  describe('check bit length', () => {
    const b = 23; // bit count
    const circuitName = 'cbl_' + b;
    let circuit: Awaited<ReturnType<typeof createWasmTester>>;

    before(async () => {
      instantiate(circuitName, 'test/float_add', {
        file: 'float_add',
        template: 'CheckBitLength',
        publicInputs: [],
        templateParams: [b],
      });
      circuit = await createWasmTester(circuitName, 'test/float_add');
      await circuit.printConstraintCount(b + 2);
    });

    it('bitlength of `in` <= `b`', async () => {
      await circuit.expectCorrectAssert(
        {
          in: '4903265',
        },
        {out: '1'}
      );
    });

    it('bitlength of `in` > `b`', async () => {
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
    const circuitName = 'shl_' + shift_bound;
    let circuit: Awaited<ReturnType<typeof createWasmTester>>;

    before(async () => {
      instantiate(circuitName, 'test/float_add', {
        file: 'float_add',
        template: 'LeftShift',
        publicInputs: [],
        templateParams: [shift_bound],
      });
      circuit = await createWasmTester(circuitName, 'test/float_add');
      await circuit.printConstraintCount(shift_bound + 2);
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

    it('should pass when `skip_checks` = 1 and `shift` is >= shift_bound', async () => {
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
    const circuitName = 'shr_' + b;
    let circuit: Awaited<ReturnType<typeof createWasmTester>>;

    before(async () => {
      instantiate(circuitName, 'test/float_add', {
        file: 'float_add',
        template: 'RightShift',
        publicInputs: [],
        templateParams: [b, shift],
      });
      circuit = await createWasmTester(circuitName, 'test/float_add');
      await circuit.printConstraintCount(b);
    });

    it('should pass - small bitwidth', async () => {
      instantiate(circuitName, 'test/float_add', {
        file: 'float_add',
        template: 'RightShift',
        publicInputs: [],
        templateParams: [b, shift],
      });
      circuit = await createWasmTester(circuitName, 'test/float_add');
      await circuit.printConstraintCount(b);

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
    // var circ_file = path.join(__dirname, 'circuits', 'normalize.circom');
    // var circ_file_msnzb = path.join(__dirname, 'circuits', 'msnzb.circom');
    // var circ, num_constraints;
    const k = 8;
    const p = 23;
    const P = 47;
    let circuit: Awaited<ReturnType<typeof createWasmTester>>;

    // before(async () => {
    //   circ = await wasm_tester(circ_file);
    //   await circ.loadConstraints();
    //   num_constraints = circ.constraints.length;

    //   console.log('Normalize #Constraints:', num_constraints, 'Expected:', 3 * (P + 1));

    //   circ_msnzb = await wasm_tester(circ_file_msnzb);
    //   await circ_msnzb.loadConstraints();
    //   num_constraints_msnzb = circ_msnzb.constraints.length;
    //   if (num_constraints < num_constraints_msnzb + 1) {
    //     console.log(
    //       'WARNING: the #constraints is less than (#constraints for MSNZB + 1). It is likely that you are not constraining the witnesses appropriately.'
    //     );
    //   }
    // });

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

    it("should fail when `m` = 0 - don't skip checks", async () => {
      await circuit.expectFailedAssert({
        e: '100',
        m: '0',
        skip_checks: '0',
      });
    });

    it('should pass when `skip_checks` = 1 and `m` is 0', async () => {
      await circuit.expectCorrectAssert({
        e: '100',
        m: '0',
        skip_checks: '1',
      });
    });
  });

  describe('msnzb', () => {
    const b = 48;
    let circuit: Awaited<ReturnType<typeof createWasmTester>>;

    // before(async () => {
    //   circ = await wasm_tester(circ_file);
    //   await circ.loadConstraints();
    //   num_constraints = circ.constraints.length;
    //   var b = 48;
    //   var expected_constraints = 3 * b - 1;
    //   console.log('MSNZB #Constraints:', num_constraints, 'Expected:', expected_constraints);
    //   if (num_constraints < expected_constraints) {
    //     console.log(
    //       'WARNING: number of constraints is less than 3b-1. It is likely that you are not constraining the witnesses appropriately.'
    //     );
    //   }
    // });

    it("should pass test 1 - don't skip checks", async () => {
      await circuit.expectCorrectAssert(
        {
          in: '1',
          skip_checks: '0',
        },
        {
          // prettier-ignore
          one_hot: ["1", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
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
          one_hot: ["0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "1"],
        }
      );
    });

    it("should fail when `in` = 0 - don't skip checks", async () => {
      await circuit.expectFailedAssert({
        in: '0',
        skip_checks: '0',
      });
    });

    it('should pass when `skip_checks` = 1 and `in` is 0', async () => {
      await circuit.expectCorrectAssert({
        in: '0',
        skip_checks: '1',
      });
    });
  });
});
