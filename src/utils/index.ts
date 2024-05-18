import type {CircomkitConfig} from '../configs';

/** A mapping from prime names to prime value as supported by Circom's `-p` option. */
export const primes: Record<CircomkitConfig['prime'], bigint> = {
  bn128: BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617'),
  bls12381: BigInt('52435875175126190479447740508185965837690552500527637822603658699938581184513'),
  goldilocks: BigInt('18446744069414584321'),
  grumpkin: BigInt('21888242871839275222246405745257275088696311157297823662689037894645226208583'),
  pallas: BigInt('28948022309329048855892746252171976963363056481941560715954676764349967630337'),
  vesta: BigInt('28948022309329048855892746252171976963363056481941647379679742748393362948097'),
  secq256r1: BigInt('115792089210356248762697446949407573530086143415290314195533631308867097853951'),
} as const;

/** A mapping from prime (decimals or hexadecimal) to prime name as supported by Circom's `-p` option. */
export const primeToName: Record<`${bigint}`, CircomkitConfig['prime']> = {
  '21888242871839275222246405745257275088548364400416034343698204186575808495617': 'bn128',
  '0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001': 'bn128',

  '52435875175126190479447740508185965837690552500527637822603658699938581184513': 'bls12381',
  '0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001': 'bls12381',

  '18446744069414584321': 'goldilocks',
  '0xffffffff00000001': 'goldilocks',

  '21888242871839275222246405745257275088696311157297823662689037894645226208583': 'grumpkin',
  '0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47': 'grumpkin',

  '28948022309329048855892746252171976963363056481941560715954676764349967630337': 'pallas',
  '0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001': 'pallas',

  '28948022309329048855892746252171976963363056481941647379679742748393362948097': 'vesta',
  '0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001': 'vesta',

  '115792089210356248762697446949407573530086143415290314195533631308867097853951': 'secq256r1',
  '0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff': 'secq256r1',
} as const;

/** JSON Stringify with a prettier format. */
export function prettyStringify(obj: unknown): string {
  return JSON.stringify(obj, undefined, 2);
}
