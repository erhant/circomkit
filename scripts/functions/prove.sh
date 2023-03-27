## Generate a proof
prove() {
  echo -e "\n${TITLE_COLOR}=== Generating proof ===${RESET}" 
  local CIRCUIT=$1
  local INPUT=$2 
  local CIRCUIT_DIR=./build/$CIRCUIT
  local OUTPUT_DIR=$CIRCUIT_DIR/$INPUT

  snarkjs groth16 prove \
    $CIRCUIT_DIR/prover_key.zkey \
    $OUTPUT_DIR/witness.wtns \
    $OUTPUT_DIR/proof.json \
    $OUTPUT_DIR/public.json

  echo -e "${LOG_COLOR}Generated under $OUTPUT_DIR${RESET}"
}
