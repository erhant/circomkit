## Clean build files
clean() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Cleaning artifacts ===${CIRCOMKIT_COLOR_RESET}"
  local CIRCUIT=$1
  local CIRCUIT_DIR=./build/$CIRCUIT
  local TARGET=./circuits/main/$CIRCUIT.circom

  rm -rf $CIRCUIT_DIR
  rm -f $TARGET

  echo -e "${CIRCOMKIT_COLOR_LOG}Deleted $CIRCUIT_DIR and $TARGET${CIRCOMKIT_COLOR_RESET}"
}
