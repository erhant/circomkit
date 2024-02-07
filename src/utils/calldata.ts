// import {CircomkitProtocol} from '../types';

import type {FflonkProof, Groth16Proof, PlonkProof, PublicSignals} from 'snarkjs';

function valuesToPaddedUint256s(vals: string[]) {
  return vals.map(val => '0x' + BigInt(val).toString(16).padStart(64, '0'));
}

function withQuotes(vals: string[]) {
  return vals.map(val => `"${val}"`);
}

export function getCalldata(
  proof: FflonkProof & Groth16Proof & PlonkProof,
  pubs: PublicSignals,
  pretty: boolean = false
) {
  const pubsCalldata: string = publicSignalsCalldata(pubs, pretty);
  let proofCalldata: string;
  switch (proof.protocol) {
    case 'groth16':
      proofCalldata = groth16Calldata(proof, pretty);
      break;
    case 'plonk':
      proofCalldata = plonkCalldata(proof, pretty);
      break;
    case 'fflonk':
      proofCalldata = fflonkCalldata(proof, pretty);
      break;
    default:
      throw 'Unknown protocol:' + proof.protocol;
  }

  return `\n${proofCalldata}\n\n${pubsCalldata}\n`;
}

function publicSignalsCalldata(pubs: PublicSignals, pretty: boolean): string {
  const pubs256 = valuesToPaddedUint256s(pubs);
  if (pretty) {
    return `uint[${pubs.length}] pubs = [\n    ${pubs256.join(',\n    ')}\n];`;
  } else {
    return `[${pubs256.map(s => `"${s}"`).join(',')}]`;
  }
}

function fflonkCalldata(proof: FflonkProof, pretty: boolean): string {
  // prettier-ignore
  const vals = valuesToPaddedUint256s([
    proof.polynomials.C1[0], proof.polynomials.C1[1],
    proof.polynomials.C2[0], proof.polynomials.C2[1],
    proof.polynomials.W1[0], proof.polynomials.W1[1],
    proof.polynomials.W2[0], proof.polynomials.W2[1],
    proof.evaluations.ql, proof.evaluations.qr, proof.evaluations.qm,
    proof.evaluations.s1, proof.evaluations.s2, proof.evaluations.s3,
    proof.evaluations.a, proof.evaluations.b, proof.evaluations.c,
    proof.evaluations.z, proof.evaluations.zw,
    proof.evaluations.t1w, proof.evaluations.t2w,
    proof.evaluations.inv,
  ]);

  if (pretty) {
    return `uint256[24] proof = [\n    ${vals.join(',\n    ')}\n];`;
  } else {
    return `[${withQuotes(vals).join(',')}]`;
  }
}

function plonkCalldata(proof: PlonkProof, pretty: boolean = false) {
  // prettier-ignore
  const vals = valuesToPaddedUint256s([
    proof.A[0], proof.A[1], proof.B[0], proof.B[1], proof.C[0], proof.C[1],
    proof.Z[0], proof.Z[1],
    proof.T1[0], proof.T1[1], proof.T2[0], proof.T2[1], proof.T3[0], proof.T3[1],
    proof.Wxi[0], proof.Wxi[1],
    proof.Wxiw[0], proof.Wxiw[1],
    proof.eval_a, proof.eval_b, proof.eval_c,
    proof.eval_s1, proof.eval_s2,
    proof.eval_zw,
  ]);

  if (pretty) {
    return `uint[24] proof = [\n    ${vals.join(',\n    ')}\n];`;
  } else {
    return `[${withQuotes(vals).join(',')}]`;
  }
}

function groth16Calldata(proof: Groth16Proof, pretty: boolean) {
  const pA = valuesToPaddedUint256s([proof.pi_a[0], proof.pi_a[1]]);
  const pB0 = valuesToPaddedUint256s([proof.pi_b[0][1], proof.pi_b[0][1]]);
  const pB1 = valuesToPaddedUint256s([proof.pi_b[1][1], proof.pi_b[1][1]]);
  const pC = valuesToPaddedUint256s([proof.pi_c[0], proof.pi_c[1]]);

  if (pretty) {
    return [
      `uint[2] pA = [${pA.join(', ')}]`,
      `uint[2][2] pB = [[${pB0.join(', ')}], [${pB1.join(', ')}]];`,
      `uint[2] pC = [${pC.join(', ')}];`,
    ].join('\n');
  } else {
    return [
      `[${withQuotes(pA).join(', ')}]`,
      `[[${withQuotes(pB0).join(', ')}], [${withQuotes(pB1).join(', ')}]]`,
      `[${withQuotes(pC).join(', ')}]`,
    ].join('\n');
  }
}
