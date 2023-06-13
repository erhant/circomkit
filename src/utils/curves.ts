import type {CircomkitConfig} from '../types/circomkit';

/** A mapping from prime (decimals) to curve name. */
export const primeToCurveName: {[key: `${number}`]: CircomkitConfig['curve']} = {
  '21888242871839275222246405745257275088548364400416034343698204186575808495617': 'bn128',
  '52435875175126190479447740508185965837690552500527637822603658699938581184513': 'bls12381',
  '18446744069414584321': 'goldilocks',
} as const;
