## Clean build files
clean() {
  echo -e "\n${TITLE_COLOR}=== Cleaning artifacts ===${RESET}"
  local CIRCUIT=$1
  local CIRCUIT_DIR=./build/$CIRCUIT

  rm -rf $CIRCUIT_DIR

  echo -e "${LOG_COLOR}Deleted $CIRCUIT_DIR${RESET}"
}
