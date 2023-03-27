## Generate a proof
prove() {
  echo -e "\n${TITLE_COLOR}=== Generating proof ===${RESET}" 
  CIRCUIT=$1
  INPUT=$2 
  CIRCUIT_DIR=./build/$CIRCUIT
  OUTPUT_DIR=$CIRCUIT_DIR/$INPUT

  snarkjs groth16 prove \
    $CIRCUIT_DIR/prover_key.zkey \
    $OUTPUT_DIR/witness.wtns \
    $OUTPUT_DIR/proof.json \
    $OUTPUT_DIR/public.json

  echo -e "${LOG_COLOR}Generated under $OUTPUT_DIR${RESET}"
}
