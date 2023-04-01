pragma circom 2.0.0;

include "./math.circom";

/*
 * Get number of bits
 */
function numOfBits(n) {
  return log2(n) + 1;
}
