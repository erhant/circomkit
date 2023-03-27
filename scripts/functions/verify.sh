## Verify a witness & proof
verify() {
  echo -e "\n${TITLE_COLOR}=== Verifying proof ===${RESET}"
  CIRCUIT=$1
  INPUT=$2
  CIRCUIT_DIR=./build/${CIRCUIT}

  snarkjs groth16 verify \
    $CIRCUIT_DIR/verification_key.json \
    $CIRCUIT_DIR/$INPUT/public.json \
    $CIRCUIT_DIR/$INPUT/proof.json

  echo -e "${LOG_COLOR}Verification complete.${RESET}"
}
