## Verify a witness & proof
verify() {
  echo -e "\n${CLIENV_COLOR_TITLE}=== Verifying proof ===${CLIENV_COLOR_RESET}"
  local CIRCUIT=$1
  local INPUT=$2
  local CIRCUIT_DIR=./build/${CIRCUIT}

  snarkjs groth16 verify \
    $CIRCUIT_DIR/verification_key.json \
    $CIRCUIT_DIR/$INPUT/public.json \
    $CIRCUIT_DIR/$INPUT/proof.json

  echo -e "${CLIENV_COLOR_LOG}Verification complete.${CLIENV_COLOR_RESET}"
}
