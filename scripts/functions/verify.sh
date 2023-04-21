## Verify a witness & proof
verify() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Verifying proof ===${CIRCOMKIT_COLOR_RESET}"
  local CIRCUIT=$1
  local INPUT=$2
  local CIRCUIT_DIR=./build/$CIRCUIT

  snarkjs $CIRCOMKIT_PROOF_SYSTEM verify \
    $CIRCUIT_DIR/verification_key.json \
    $CIRCUIT_DIR/$INPUT/public.json \
    $CIRCUIT_DIR/$INPUT/proof.json

  echo -e "${CIRCOMKIT_COLOR_LOG}Verification complete.${CIRCOMKIT_COLOR_RESET}"
}
