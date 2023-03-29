## Clean build files
clean() {
  echo -e "\n${CLIENV_COLOR_TITLE}=== Cleaning artifacts ===${CLIENV_COLOR_RESET}"
  local CIRCUIT=$1
  local CIRCUIT_DIR=./build/$CIRCUIT
  local TARGET=./circuits/main/$CIRCUIT.circom

  rm -rf $CIRCUIT_DIR
  rm -f $TARGET

  echo -e "${CLIENV_COLOR_LOG}Deleted $CIRCUIT_DIR and $TARGET${CLIENV_COLOR_RESET}"
}
