## Instantiate the main component
instantiate() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Creating main component ===${CIRCOMKIT_COLOR_RESET}"
  local CIRCUIT=$1
  local DIR=$2

  # generate the circuit main component
  mkdir -p ./circuits/$DIR
  npx ts-node ./utils/instantiate.ts $CIRCUIT $DIR

  echo -e "${CIRCOMKIT_COLOR_LOG}Done!${CIRCOMKIT_COLOR_RESET}"
}
