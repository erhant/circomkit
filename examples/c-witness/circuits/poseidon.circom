pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

// Hashes N inputs `rounds` times, a chain of Poseidon hashes
template PoseidonChain(N, rounds) {
  signal input in[N];
  signal output out;

  signal hashes[rounds];
  hashes[0] <== Poseidon(N)(in);
  for (var i = 1; i < rounds; i++) {
    hashes[i] <== Poseidon(1)([hashes[i-1]]);
  }
  out <== hashes[rounds-1];
}
