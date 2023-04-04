pragma circom 2.0.0;

// circuits adapted from https://github.com/rdi-berkeley/zkp-mooc-lab

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/switcher.circom";
include "circomlib/circuits/gates.circom";
include "circomlib/circuits/bitify.circom";

/*
 * Finds Math.floor(log2(n))
 */
function log2(n) {
  var tmp = 1, ans = 1;
  while (tmp < n) {
    ans++;
    tmp *= 2;
  }
  return ans;
}

/*
 * Basically `out = cond ? ifTrue : ifFalse`
 */
template IfElse() {
  signal input cond;
  signal input ifTrue;
  signal input ifFalse;
  signal output out;

  // cond * T - cond * F + F
  // 0    * T - 0    * F + F = 0 - 0 + F = F
  // 1    * T - 1    * F + F = T - F + F = T
  out <== cond * (ifTrue - ifFalse) + ifFalse;
}

/*
 * Outputs `out` = 1 if `in` is at most `b` bits long, and 0 otherwise.
 */
template CheckBitLength(b) {
  assert(b < 254);
  signal input in;
  signal output out;

  // compute b-bit representation of the number  
  signal bits[b];
  var sum_of_bits = 0;
  for (var i = 0; i < b; i++) {
    bits[i] <-- (in >> i) & 1;
    bits[i] * (1 - bits[i]) === 0;
    sum_of_bits += (2 ** i) * bits[i];
  }

  // check if sum is equal to number itself
  component eq = IsEqual();
  eq.in[0] <== sum_of_bits;
  eq.in[1] <== in;
  out <== eq.out;
}

/*
 * Enforces the well-formedness of an exponent-mantissa pair (e, m), which is defined as follows:
 * if `e` is zero, then `m` must be zero
 * else, `e` must be at most `k` bits long, and `m` must be in the range [2^p, 2^p+1)
 */
template CheckWellFormedness(k, p) {
  signal input e;
  signal input m;

  // check if `e` is zero
  component is_e_zero = IsZero();
  is_e_zero.in <== e;

  // Case I: `e` is zero
  //// `m` must be zero
  component is_m_zero = IsZero();
  is_m_zero.in <== m;

  // Case II: `e` is nonzero
  //// `e` is `k` bits
  component check_e_bits = CheckBitLength(k);
  check_e_bits.in <== e;
  //// `m` is `p`+1 bits with the MSB equal to 1
  //// equivalent to check `m` - 2^`p` is in `p` bits
  component check_m_bits = CheckBitLength(p);
  check_m_bits.in <== m - (1 << p);

  // choose the right checks based on `is_e_zero`
  component if_else = IfElse();
  if_else.cond <== is_e_zero.out;
  if_else.ifTrue <== is_m_zero.out;
  //// check_m_bits.out * check_e_bits.out is equivalent to check_m_bits.out AND check_e_bits.out
  if_else.ifFalse <== check_m_bits.out * check_e_bits.out;

  // assert that those checks passed
  if_else.out === 1;
}

/*
 * Right-shifts `x` by `shift` bits to output `y`, where `shift` is a public circuit parameter.
 */
template RightShift(b, shift) {
  assert(shift < b);
  signal input x;
  signal output y;
  
  // convert number to bits
  component x_bits = Num2Bits(b);
  x_bits.in <== x;

  // do the shifting
  signal y_bits[b-shift];
  for (var i = 0; i < b-shift; i++) {
    y_bits[i] <== x_bits.out[shift+i];
  } 

  // convert shifted bits to number
  component y_num = Bits2Num(b-shift);
  y_num.in <== y_bits;
  y <== y_num.out;
}

/*
 * Rounds the input floating-point number and checks to ensure that rounding does not make the mantissa unnormalized.
 * Rounding is necessary to prevent the bitlength of the mantissa from growing with each successive operation.
 * The input is a normalized floating-point number (e, m) with precision `P`, where `e` is a `k`-bit exponent and `m` is a `P`+1-bit mantissa.
 * The output is a normalized floating-point number (e_out, m_out) representing the same value with a lower precision `p`.
 */
template RoundAndCheck(k, p, P) {
  signal input e;
  signal input m;
  signal output e_out;
  signal output m_out;
  assert(P > p);

  // check if no overflow occurs
  component if_no_overflow = LessThan(P+1);
  if_no_overflow.in[0] <== m;
  if_no_overflow.in[1] <== (1 << (P+1)) - (1 << (P-p-1));
  signal no_overflow <== if_no_overflow.out;

  var round_amt = P-p;
  // Case I: no overflow
  // compute (m + 2^{round_amt-1}) >> round_amt
  var m_prime = m + (1 << (round_amt-1));
  component right_shift = RightShift(P+2, round_amt);
  right_shift.x <== m_prime;
  var m_out_1 = right_shift.y;
  var e_out_1 = e;

  // Case II: overflow
  var e_out_2 = e + 1;
  var m_out_2 = (1 << p);

  // select right output based on no_overflow
  component if_else[2];
  for (var i = 0; i < 2; i++) {
    if_else[i] = IfElse();
    if_else[i].cond <== no_overflow;
  }
  if_else[0].ifTrue <== e_out_1;
  if_else[0].ifFalse <== e_out_2;
  if_else[1].ifTrue <== m_out_1;
  if_else[1].ifFalse <== m_out_2;
  e_out <== if_else[0].out;
  m_out <== if_else[1].out;
}

template Num2BitsWithSkipChecks(b) {
  signal input in;
  signal input skip_checks;
  signal output out[b];

  for (var i = 0; i < b; i++) {
    out[i] <-- (in >> i) & 1;
    out[i] * (1 - out[i]) === 0;
  }
  var sum_of_bits = 0;
  for (var i = 0; i < b; i++) {
    sum_of_bits += (2 ** i) * out[i];
  }

  // is always true if skip_checks is 1
  (sum_of_bits - in) * (1 - skip_checks) === 0;
}

template LessThanWithSkipChecks(n) {
  assert(n <= 252);
  signal input in[2];
  signal input skip_checks;
  signal output out;

  component n2b = Num2BitsWithSkipChecks(n+1);
  n2b.in <== in[0] + (1<<n) - in[1];
  n2b.skip_checks <== skip_checks; 
  out <== 1-n2b.out[n];
}

/*
 * Left-shifts `x` by `shift` bits to output `y`.
 * Enforces 0 <= `shift` < `shift_bound`.
 * If `skip_checks` = 1, then we don't care about the output 
 * and the `shift_bound` constraint is not enforced.
 */
template LeftShift(shift_bound) {
  signal input x;
  signal input shift;
  signal input skip_checks;
  signal output y;

  // find number of bits in shift_bound
  var n = log2(shift_bound) + 1;

  // convert "shift" to bits
  component shift_bits = Num2BitsWithSkipChecks(n);
  shift_bits.in <== shift;
  shift_bits.skip_checks <== skip_checks;

  // check "shift" < "shift_bound" 
  component less_than = LessThanWithSkipChecks(n);
  less_than.in[0] <== shift;
  less_than.in[1] <== shift_bound;
  less_than.skip_checks <== skip_checks;
  (less_than.out - 1) * (1 - skip_checks) === 0;
  
  // compute pow2_shift from bits
  // represents the shift amount
  var pow2_shift = 1;
  component muxes[n];
  for (var i = 0; i < n; i++) {
    muxes[i] = IfElse();
    muxes[i].cond <== shift_bits.out[i];
    muxes[i].ifTrue <== pow2_shift * (2 ** (2 ** i));
    muxes[i].ifFalse <== pow2_shift;
    pow2_shift = muxes[i].out;
  }

  // if skip checks, set pow2_shift to 0
  component if_else = IfElse();
  if_else.cond <== skip_checks;
  if_else.ifTrue <== 0;
  if_else.ifFalse <== pow2_shift;
  pow2_shift = if_else.out; // not <== because it's a variable

  // do the shift
  y <== x * pow2_shift;

}

/*
 * Find the Most-Significant Non-Zero Bit (MSNZB) of `in`, where `in` is assumed to be non-zero value of `b` bits.
 * Outputs the MSNZB as a one-hot vector `one_hot` of `b` bits, where `one_hot`[i] = 1 if MSNZB(`in`) = i and 0 otherwise.
 * The MSNZB is output as a one-hot vector to reduce the number of constraints in the subsequent `Normalize` template.
 * Enforces that `in` is non-zero as MSNZB(0) is undefined.
 * If `skip_checks` = 1, then we don't care about the output and the non-zero constraint is not enforced.
 */
template MSNZB(b) {
  signal input in;
  signal input skip_checks;
  signal output one_hot[b];

  // compute ell, ensuring that it is made of bits too
  for (var i = 0; i < b; i++) {
    var temp;
    if (((1 << i) <= in) && (in < (1 << (i + 1)))) {
      temp = 1;
    } else {
      temp = 0;
    }
    one_hot[i] <-- temp;
  }

  // verify that one_hot only has bits, and has only one set bit
  var sum_of_bits = 0;
  for (var i = 0; i < b; i++) {
    sum_of_bits += one_hot[i];
    one_hot[i] * (1 - one_hot[i]) === 0; // is bit
  }
  (1 - sum_of_bits) * (1 - skip_checks) === 0;

  // verify that the set bit is at correct place
  var pow2_ell = 0;
  var pow2_ell_plus1 = 0;
  for (var i = 0; i < b; i++) { 
    pow2_ell += one_hot[i] * (1 << i);
    pow2_ell_plus1 += one_hot[i] * (1 << (i + 1));
  }
  component lt1 = LessThan(b+1);
  lt1.in[0] <== in;
  lt1.in[1] <== pow2_ell_plus1;
  (lt1.out - 1) * (1 - skip_checks) === 0;
  component lt2 = LessThan(b);
  lt2.in[0] <== pow2_ell - 1;
  lt2.in[1] <== in;
  (lt2.out - 1) * (1 - skip_checks) === 0;
}

/*
 * Normalizes the input floating-point number.
 * The input is a floating-point number with a `k`-bit exponent `e` and a `P`+1-bit *unnormalized* mantissa `m` with precision `p`, where `m` is assumed to be non-zero.
 * The output is a floating-point number representing the same value with exponent `e_out` and a *normalized* mantissa `m_out` of `P`+1-bits and precision `P`.
 * Enforces that `m` is non-zero as a zero-value can not be normalized.
 * If `skip_checks` = 1, then we don't care about the output and the non-zero constraint is not enforced.
 */
template Normalize(k, p, P) {
  signal input e;
  signal input m;
  signal input skip_checks;
  signal output e_out;
  signal output m_out;
  assert(P > p);

  // compute ell = MSNZB
  component msnzb = MSNZB(P+1);
  msnzb.in <== m;
  msnzb.skip_checks <== skip_checks;

  // compute ell and L = 2 ** (P - ell)
  var ell, L;
  for (var i = 0; i < P+1; i++) {
    ell += msnzb.one_hot[i] * i;
    L += msnzb.one_hot[i] * (1 << (P - i));
  }

  // return
  e_out <== e + ell - p;
  m_out <== m * L;
}

/*
 * Adds two floating-point numbers.
 * The inputs are normalized floating-point numbers with `k`-bit exponents `e` and `p`+1-bit mantissas `m` with scale `p`.
 * Does not assume that the inputs are well-formed and makes appropriate checks for the same.
 * The output is a normalized floating-point number with exponent `e_out` and mantissa `m_out` of `p`+1-bits and scale `p`.
 * Enforces that inputs are well-formed.
 */
template FloatAdd(k, p) {
  signal input e[2];
  signal input m[2];
  signal output e_out;
  signal output m_out;

  // check well formedness
  component well_form[2];
  for (var i = 0; i < 2; i++) {
    well_form[i] = CheckWellFormedness(k, p);
    well_form[i].e <== e[i];
    well_form[i].m <== m[i];
  }

  // find the larger magnitude
  var magn[2];
  component larger_magn = LessThan(k+p+1);
  for (var i = 0; i < 2; i++) {
    magn[i] = (e[i] * (1 << (p+1))) + m[i];
    larger_magn.in[i] <== magn[i];
  }
  signal is_input2_larger <== larger_magn.out;
  
  // arrange by magnitude
  var input_1[2] = [e[0], m[0]];
  var input_2[2] = [e[1], m[1]];
  component switcher[2];
  for (var i = 0; i < 2; i++) {
    switcher[i] = Switcher();
    switcher[i].sel <== is_input2_larger;
    switcher[i].L <== input_1[i];
    switcher[i].R <== input_2[i];
  }
  var alpha_e = switcher[0].outL;
  var alpha_m = switcher[1].outL;
  var beta_e = switcher[0].outR;
  var beta_m = switcher[1].outR;

  // if-else part
  var diff_e = alpha_e - beta_e;
  component compare_diff_e = LessThan(k);
  compare_diff_e.in[0] <== p+1;
  compare_diff_e.in[1] <== diff_e;
  component is_alpha_e_zero = IsZero();
  is_alpha_e_zero.in <== alpha_e;
  
  //// case 1
  component or = OR();
  or.a <== compare_diff_e.out;
  or.b <== is_alpha_e_zero.out;
  signal is_case_1 <== or.out; // true branch
  var case_1_output[2] = [alpha_e, alpha_m];

  //// case 2
  component shl = LeftShift(p+2);
  shl.x <== alpha_m;
  shl.shift <== diff_e;
  shl.skip_checks <== is_case_1; // skip if this isnt the case
  alpha_m = shl.y;
  var mantissa = alpha_m + beta_m;
  var exponent = beta_e;
  component normalize = Normalize(k, p, 2*p + 1);
  normalize.m <== mantissa;
  normalize.e <== exponent;
  normalize.skip_checks <== is_case_1;
  component rnc = RoundAndCheck(k, p, 2*p + 1);
  rnc.m <== normalize.m_out;
  rnc.e <== normalize.e_out;
  var case_2_output[2] = [rnc.e_out, rnc.m_out];

  // return
  component if_else[2];
  for (var i = 0; i < 2; i++) {
    if_else[i] = IfElse();
    if_else[i].cond <== is_case_1;
    if_else[i].ifTrue <== case_1_output[i];
    if_else[i].ifFalse <== case_2_output[i];
  }
  e_out <== if_else[0].out;
  m_out <== if_else[1].out;
}
