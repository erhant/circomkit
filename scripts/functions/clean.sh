## Clean build files
clean() {
  echo -e "\n${CLIENV_COLOR_TITLE}=== Cleaning artifacts ===${CLIENV_COLOR_RESET}"
  local CIRCUIT=$1
  local CIRCUIT_DIR=./build/$CIRCUIT

  rm -rf $CIRCUIT_DIR

  echo -e "${CLIENV_COLOR_LOG}Deleted $CIRCUIT_DIR${CLIENV_COLOR_RESET}"
}
