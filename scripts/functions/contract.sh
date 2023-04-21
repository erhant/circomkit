## Exports a solidity contract for the verifier
contract() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Generating Solidity verifier ===${CIRCOMKIT_COLOR_RESET}" 
  local CIRCUIT=$1
  local CIRCUIT_DIR=./build/$CIRCUIT

  snarkjs zkey export solidityverifier \
    $CIRCUIT_DIR/prover_key.zkey \
    $CIRCUIT_DIR/verifier.sol

  echo -e "${CIRCOMKIT_COLOR_LOG}Contract created at $CIRCUIT_DIR/verifier.sol!${CIRCOMKIT_COLOR_RESET}"
}
