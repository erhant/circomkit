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

/// Returns the number of bytes used to encode a field element of the given prime
/// in Circom's binary `.wtns`/`.r1cs` formats (the `n8` field).
///
/// Matches snarkjs/ffjavascript: the modulus bit-length rounded up to a whole
/// number of 64-bit words, times 8. e.g. bn128 (254 bits) → 32, goldilocks
/// (64 bits) → 8.
///
/// TODO: add link here
pub fn prime_field_n8(prime: Prime) -> u32 {
    let bits = prime_value(prime).bits();
    (((bits - 1) / 64 + 1) * 8) as u32
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

    #[test]
    fn field_n8_matches_snarkjs_word_alignment() {
        // 254/255-bit curves pack into 32 bytes (4 64-bit words).
        assert_eq!(prime_field_n8(Prime::Bn128), 32);
        assert_eq!(prime_field_n8(Prime::Bls12381), 32);
        assert_eq!(prime_field_n8(Prime::Grumpkin), 32);
        assert_eq!(prime_field_n8(Prime::Pallas), 32);
        assert_eq!(prime_field_n8(Prime::Vesta), 32);
        assert_eq!(prime_field_n8(Prime::Secq256r1), 32);
        // Goldilocks is a 64-bit field — a single word.
        assert_eq!(prime_field_n8(Prime::Goldilocks), 8);
    }
}
