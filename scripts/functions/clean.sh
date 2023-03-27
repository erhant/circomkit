## Clean build files
clean() {
  echo -e "\n${TITLE_COLOR}=== Cleaning artifacts ===${RESET}"
  CIRCUIT=$1
  CIRCUIT_DIR=./build/$CIRCUIT

  rm -rf $CIRCUIT_DIR

  echo -e "${LOG_COLOR}Deleted $CIRCUIT_DIR${RESET}"
}


