use circomkit::signals;
use num_bigint::BigInt;

use super::common::test_circomkit;

fn multiplier_tester() -> (circomkit::WitnessTester, std::sync::MutexGuard<'static, ()>) {
    let (ck, guard) = test_circomkit();
    let config = ck.config.circuits["multiplier_3"].clone();
    let tester = ck.witness_tester("multiplier_3", config).unwrap();
    (tester, guard)
}

#[test]
fn expect_pass_multiplier() {
    let (tester, _guard) = multiplier_tester();

    let input = signals! { "in" => vec![2_i64, 4, 10] };
    let output = signals! { "out" => 80_i64 };
    tester.expect_pass(&input, Some(&output)).unwrap();
}

#[test]
fn expect_pass_different_values() {
    let (tester, _guard) = multiplier_tester();

    let input = signals! { "in" => vec![3_i64, 5, 7] };
    let output = signals! { "out" => 105_i64 };
    tester.expect_pass(&input, Some(&output)).unwrap();
}

#[test]
fn expect_fail_input_contains_one() {
    let (tester, _guard) = multiplier_tester();

    // Multiplier rejects inputs containing 1 (IsZero check)
    let input = signals! { "in" => vec![1_i64, 4, 10] };
    let err = tester.expect_fail(&input).unwrap();
    assert!(!err.is_empty());
}

#[test]
fn compute_output() {
    let (tester, _guard) = multiplier_tester();

    let input = signals! { "in" => vec![2_i64, 3, 5] };
    let output = tester.compute(&input, &["out"]).unwrap();

    assert_eq!(
        output["out"],
        circomkit::SignalValue::Single(BigInt::from(30))
    );
}

#[test]
fn constraint_count() {
    let (tester, _guard) = multiplier_tester();
    // Multiplier(3) with optimization=0: 15 constraints
    tester.expect_constraint_count(15, true).unwrap();
}

#[test]
fn constraint_count_at_least() {
    let (tester, _guard) = multiplier_tester();
    tester.expect_constraint_count(5, false).unwrap();
}

#[test]
fn arrays_pass() {
    let (ck, _guard) = test_circomkit();
    let config = ck.config.circuits["arrays_2_3"].clone();
    let tester = ck.witness_tester("arrays_2_3", config).unwrap();

    let input = signals! {
        "in" => 1_i64,
        "in1D" => vec![2_i64, 3],
        "in2D" => vec![
            vec![4_i64, 5, 6],
            vec![7_i64, 8, 9]
        ],
    };

    // Arrays circuit just constrains relationships, no explicit output
    tester.expect_pass(&input, None).unwrap();
}

#[test]
fn arrays_fail_bad_sequence() {
    let (ck, _guard) = test_circomkit();
    let config = ck.config.circuits["arrays_2_3"].clone();
    let tester = ck.witness_tester("arrays_2_3", config).unwrap();

    // in1D should be consecutive (in1D[0]+1 == in1D[1])
    let input = signals! {
        "in" => 1_i64,
        "in1D" => vec![2_i64, 5],
        "in2D" => vec![
            vec![4_i64, 5, 6],
            vec![7_i64, 8, 9]
        ],
    };

    tester.expect_fail(&input).unwrap();
}

#[test]
fn errors_pass_valid() {
    let (ck, _guard) = test_circomkit();
    let config = ck.config.circuits["errors"].clone();
    let tester = ck.witness_tester("errors", config).unwrap();

    // in != 1, so in=0 is fine
    let input = signals! { "in" => 0_i64, "inin" => vec![3_i64, 5] };
    let output = signals! { "out" => 15_i64 }; // 0 + (3 * 5) = 15
    tester.expect_pass(&input, Some(&output)).unwrap();
}

#[test]
fn errors_fail_assert() {
    let (ck, _guard) = test_circomkit();
    let config = ck.config.circuits["errors"].clone();
    let tester = ck.witness_tester("errors", config).unwrap();

    // in=1 triggers assert(in != 1)
    let input = signals! { "in" => 1_i64, "inin" => vec![3_i64, 5] };
    tester.expect_fail(&input).unwrap();
}

#[test]
fn errors_fail_wrong_array_size() {
    let (ck, _guard) = test_circomkit();
    let config = ck.config.circuits["errors"].clone();
    let tester = ck.witness_tester("errors", config).unwrap();

    // inin expects 2 elements, giving 1 should fail
    let input = signals! { "in" => 0_i64, "inin" => vec![3_i64] };
    let result = tester.calculate_witness(&input);
    assert!(result.is_err());
}

#[test]
fn custom_templates_pass() {
    let (ck, _guard) = test_circomkit();
    let config = ck.config.circuits["custom_mul"].clone();
    let tester = ck.witness_tester("custom_mul", config).unwrap();

    let input = signals! { "in1" => 3_i64, "in2" => 7_i64 };
    let output = signals! { "out" => 21_i64 };
    tester.expect_pass(&input, Some(&output)).unwrap();
}

#[test]
fn custom_templates_wrong_output() {
    let (ck, _guard) = test_circomkit();
    let config = ck.config.circuits["custom_mul"].clone();
    let tester = ck.witness_tester("custom_mul", config).unwrap();

    // 3 * 7 = 21, not 42
    let input = signals! { "in1" => 3_i64, "in2" => 7_i64 };
    let wrong_output = signals! { "out" => 42_i64 };
    let result = tester.expect_pass(&input, Some(&wrong_output));
    assert!(result.is_err());
}

#[test]
fn tags_bounded_add_pass() {
    let (ck, _guard) = test_circomkit();
    let config = ck.config.circuits["bounded_add_8"].clone();
    let tester = ck.witness_tester("bounded_add_8", config).unwrap();

    // 100 + 50 = 150, both fit in 8 bits (max 255)
    let input = signals! { "a" => 100_i64, "b" => 50_i64 };
    let output = signals! { "out" => 150_i64 };
    tester.expect_pass(&input, Some(&output)).unwrap();
}
