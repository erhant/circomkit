#[cfg(feature = "witness-wasm")]
mod tests {
    use std::path::PathBuf;

    use circomkit_core::signals;
    use circomkit_witness::{WasmWitnessCalculator, WitnessCalculator};
    use num_bigint::BigInt;

    fn test_data_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../tests/data/multiplier_30")
    }

    fn wasm_path() -> PathBuf {
        test_data_dir().join("multiplier_30.wasm")
    }

    #[test]
    fn calculate_witness_multiplier_30() {
        let calc = WasmWitnessCalculator::new(wasm_path()).unwrap();

        // 30 inputs of 2 => output = 2^30 = 1073741824
        let input = signals! {
            "in" => vec![2_i64; 30],
        };

        let witness = calc.calculate(&input).unwrap();

        // witness[0] is always 1 (the "one" wire)
        assert_eq!(witness[0], BigInt::from(1));

        // witness[1] should be the output: 2^30
        assert_eq!(witness[1], BigInt::from(1073741824u64));

        assert!(witness.len() > 30);
    }

    #[test]
    fn calculate_witness_all_ones() {
        let calc = WasmWitnessCalculator::new(wasm_path()).unwrap();

        let input = signals! {
            "in" => vec![1_i64; 30],
        };

        let witness = calc.calculate(&input).unwrap();
        assert_eq!(witness[0], BigInt::from(1));
        assert_eq!(witness[1], BigInt::from(1));
    }

    #[test]
    fn wrong_input_count_fails() {
        let calc = WasmWitnessCalculator::new(wasm_path()).unwrap();

        // Only 5 inputs instead of 30
        let input = signals! {
            "in" => vec![2_i64; 5],
        };

        let result = calc.calculate(&input);
        assert!(result.is_err());
    }
}
