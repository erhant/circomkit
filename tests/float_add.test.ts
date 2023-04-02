import {createWasmTester, printConstraintCount} from '../utils/wasmTester';
import {ProofTester} from '../utils/proofTester';
import type {CircuitSignals, FullProof} from '../types/circuit';
import {assert, expect} from 'chai';

describe('fp32', () => {
  let circuit: Awaited<ReturnType<typeof createWasmTester>>;

  before(async () => {
    circuit = await createWasmTester('fp32');
    await circuit.loadConstraints();
    await printConstraintCount(circuit, 401);
  });

  it('case I test', async () => {
    const witness = await circuit.calculateWitness(
      {
        e: ['43', '5'],
        m: ['11672136', '10566265'],
      },
      true
    );
    await circuit.checkConstraints(witness);
    await circuit.assertOut(witness, {e_out: '43', m_out: '11672136'});
  });

  it('case II test 1', async () => {
    const witness = await circuit.calculateWitness(
      {
        e: ['104', '106'],
        m: ['12444445', '14159003'],
      },
      true
    );
    await circuit.checkConstraints(witness);
    await circuit.assertOut(witness, {e_out: '107', m_out: '8635057'});
  });

  it('case II test 2', async () => {
    const witness = await circuit.calculateWitness(
      {
        e: ['176', '152'],
        m: ['16777215', '16777215'],
      },
      true
    );
    await circuit.checkConstraints(witness);
    await circuit.assertOut(witness, {e_out: '177', m_out: '8388608'});
  });

  it('case II test 3', async () => {
    const witness = await circuit.calculateWitness(
      {
        e: ['142', '142'],
        m: ['13291872', '13291872'],
      },
      true
    );
    await circuit.checkConstraints(witness);
    await circuit.assertOut(witness, {e_out: '143', m_out: '13291872'});
  });

  it('one input zero test', async () => {
    const witness = await circuit.calculateWitness(
      {
        e: ['0', '43'],
        m: ['0', '10566265'],
      },
      true
    );
    await circuit.checkConstraints(witness);
    await circuit.assertOut(witness, {e_out: '43', m_out: '10566265'});
  });

  it('both inputs zero test', async () => {
    const witness = await circuit.calculateWitness(
      {
        e: ['0', '0'],
        m: ['0', '0'],
      },
      true
    );
    await circuit.checkConstraints(witness);
    await circuit.assertOut(witness, {e_out: '0', m_out: '0'});
  });

  it('should fail - exponent zero but mantissa non-zero', async () => {
    await circuit
      .calculateWitness(
        {
          e: ['0', '0'],
          m: ['0', '10566265'],
        },
        true
      )
      .then(
        () => assert.fail(),
        err => expect(err.message.slice(0, 21)).to.eq('Error: Assert Failed.')
      );
  });

  it('should fail - mantissa >= 2^{p+1}', async () => {
    await circuit
      .calculateWitness(
        {
          e: ['0', '43'],
          m: ['0', '16777216'],
        },
        true
      )
      .then(
        () => assert.fail(),
        err => expect(err.message.slice(0, 21)).to.eq('Error: Assert Failed.')
      );
  });

  it('should fail - mantissa < 2^{p}', async () => {
    await circuit
      .calculateWitness(
        {
          e: ['0', '43'],
          m: ['0', '6777216'],
        },
        true
      )
      .then(
        () => assert.fail(),
        err => expect(err.message.slice(0, 21)).to.eq('Error: Assert Failed.')
      );
  });

  it('should fail - exponent >= 2^k', async () => {
    await circuit
      .calculateWitness(
        {
          e: ['0', '256'],
          m: ['0', '10566265'],
        },
        true
      )
      .then(
        () => assert.fail(),
        err => expect(err.message.slice(0, 21)).to.eq('Error: Assert Failed.')
      );
  });
});

// describe('FP64Add', () => {
//   var circ_file = path.join(__dirname, 'circuits', 'fp64_add.circom');
//   var circ, num_constraints;

//   before(async () => {
//     circ = await wasm_tester(circ_file);
//     await circuit.loadConstraints();
//     num_constraints = circuit.constraints.length;
//     console.log('Float64 Add #Constraints:', num_constraints, 'Expected:', 819);
//   });

//   it('case I test', async () => {
//     const input = {
//       e: ['1122', '1024'],
//       m: ['7807742059002284', '7045130465601185'],
//     };
//     const witness = await circuit.calculateWitness(input, 1);
//     await circuit.checkConstraints(witness);
//     await circuit.assertOut(witness, {e_out: '1122', m_out: '7807742059002284'});
//   });

//   it('case II test 1', async () => {
//     const input = {
//       e: ['1056', '1053'],
//       m: ['8879495032259305', '5030141535601637'],
//     };
//     const witness = await circuit.calculateWitness(input);
//     await circuit.checkConstraints(witness);
//     await circuit.assertOut(witness, {e_out: '1057', m_out: '4754131362104755'});
//   });

//   it('case II test 2', async () => {
//     const input = {
//       e: ['1035', '982'],
//       m: ['4804509148660890', '8505192799372177'],
//     };
//     const witness = await circuit.calculateWitness(input);
//     await circuit.checkConstraints(witness);
//     await circuit.assertOut(witness, {e_out: '1035', m_out: '4804509148660891'});
//   });

//   it('case II test 3', async () => {
//     const input = {
//       e: ['982', '982'],
//       m: ['8505192799372177', '8505192799372177'],
//     };
//     const witness = await circuit.calculateWitness(input);
//     await circuit.checkConstraints(witness);
//     await circuit.assertOut(witness, {e_out: '983', m_out: '8505192799372177'});
//   });

//   it('one input zero test', async () => {
//     const input = {
//       e: ['0', '982'],
//       m: ['0', '8505192799372177'],
//     };
//     const witness = await circuit.calculateWitness(input);
//     await circuit.checkConstraints(witness);
//     await circuit.assertOut(witness, {e_out: '982', m_out: '8505192799372177'});
//   });

//   it('both inputs zero test', async () => {
//     const input = {
//       e: ['0', '0'],
//       m: ['0', '0'],
//     };
//     const witness = await circuit.calculateWitness(input);
//     await circuit.checkConstraints(witness);
//     await circuit.assertOut(witness, {e_out: '0', m_out: '0'});
//   });

//   it('should fail - exponent zero but mantissa non-zero', async () => {
//     const input = {
//       e: ['0', '0'],
//       m: ['0', '8505192799372177'],
//     };
//     try {
//       const witness = await circuit.calculateWitness(input);
//     } catch (e) {
//       return 0;
//     }
//     assert.fail('should have thrown an error');
//   });

//   it('should fail - mantissa < 2^{p}', async () => {
//     const input = {
//       e: ['0', '43'],
//       m: ['0', '16777216'],
//     };
//     try {
//       const witness = await circuit.calculateWitness(input);
//     } catch (e) {
//       return 0;
//     }
//     assert.fail('should have thrown an error');
//   });

// });
