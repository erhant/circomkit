pragma circom 2.0.0;

/*
 * Computes Math.floor(log2(n))
 */
function log2(n) {
  var tmp = 1, ans = 1;
  while (tmp < n) {
    ans++;
    tmp *= 2;
  }
  return ans;
}
