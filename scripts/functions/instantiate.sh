## Instantiate the main component
instantiate() {
  echo -e "\n${CLIENV_COLOR_TITLE}=== Creating main component ===${CLIENV_COLOR_RESET}"
  local CIRCUIT=$1
  local DIR=$2

  # generate the circuit main component
  mkdir -p ./circuits/$DIR
  npx ts-node ./utils/instantiate.ts $CIRCUIT $DIR

  echo -e "${CLIENV_COLOR_LOG}Done!${CLIENV_COLOR_RESET}"
}
