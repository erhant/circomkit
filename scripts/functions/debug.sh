## Debug a witness
debug() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Debugging witness ===${CIRCOMKIT_COLOR_RESET}" 
  local CIRCUIT=$1
  local INPUT=$2 
  local CIRCUIT_DIR=./build/$CIRCUIT
  local OUTPUT_DIR=./build/$CIRCUIT/$INPUT      # directory for proof & public signals
  local INPUT_DIR=./inputs/$CIRCUIT             # directory for inputs

  snarkjs wtns debug \
    $CIRCUIT_DIR/${CIRCUIT}_js/$CIRCUIT.wasm \
    $INPUT_DIR/$INPUT.json \
    $OUTPUT_DIR/witness.wtns \
    $CIRCUIT_DIR/$CIRCUIT.sym

  echo -e "${CIRCOMKIT_COLOR_LOG}Done!${CIRCOMKIT_COLOR_RESET}"
}
