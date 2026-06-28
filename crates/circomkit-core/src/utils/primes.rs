use num_bigint::BigUint;

use crate::enums::Prime;

/// Returns the field prime value for a given prime variant.
pub fn prime_value(prime: Prime) -> BigUint {
    match prime {
        Prime::Bn128 => BigUint::parse_bytes(
            b"21888242871839275222246405745257275088548364400416034343698204186575808495617",
            10,
        )
        .expect("valid bn128 prime"),
        Prime::Bls12381 => BigUint::parse_bytes(
            b"73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001",
            16,
        )
        .expect("valid bls12381 prime"),
        Prime::Goldilocks => {
            BigUint::parse_bytes(b"18446744069414584321", 10).expect("valid goldilocks prime")
        }
        Prime::Grumpkin => BigUint::parse_bytes(
            b"21888242871839275222246405745257275088696311157297823662689037894645226208583",
            10,
        )
        .expect("valid grumpkin prime"),
        Prime::Pallas => BigUint::parse_bytes(
            b"28948022309329048855892746252171976963363056481941560715954676764349967630337",
            10,
        )
        .expect("valid pallas prime"),
        Prime::Vesta => BigUint::parse_bytes(
            b"28948022309329048855892746252171976963363056481941647379583120057206261314561",
            10,
        )
        .expect("valid vesta prime"),
        Prime::Secq256r1 => BigUint::parse_bytes(
            b"115792089210356248762697446949407573530086143415290314195533631308867097853951",
            10,
        )
        .expect("valid secq256r1 prime"),
    }
}

/// Attempts to identify a `Prime` variant from its field value.
pub fn prime_from_value(value: &BigUint) -> Option<Prime> {
    let primes = [
        Prime::Bn128,
        Prime::Bls12381,
        Prime::Goldilocks,
        Prime::Grumpkin,
        Prime::Pallas,
        Prime::Vesta,
        Prime::Secq256r1,
    ];
    primes.into_iter().find(|p| prime_value(*p) == *value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_all_primes() {
        let primes = [
            Prime::Bn128,
            Prime::Bls12381,
            Prime::Goldilocks,
            Prime::Grumpkin,
            Prime::Pallas,
            Prime::Vesta,
            Prime::Secq256r1,
        ];
        for p in primes {
            let val = prime_value(p);
            assert_eq!(prime_from_value(&val), Some(p), "roundtrip failed for {p}");
        }
    }

    #[test]
    fn unknown_prime_returns_none() {
        let unknown = BigUint::from(42u32);
        assert_eq!(prime_from_value(&unknown), None);
    }
}
