## Exports a solidity contract for the verifier
calldata() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Exporting calldata ===${CIRCOMKIT_COLOR_RESET}" 
  local CIRCUIT=$1
  local INPUT=$2 
  local CIRCUIT_DIR=./build/$CIRCUIT

  snarkjs zkey export soliditycalldata  \
    $CIRCUIT_DIR/$INPUT/public.json \
    $CIRCUIT_DIR/$INPUT/proof.json

  echo -e "${CIRCOMKIT_COLOR_LOG}Done!${CIRCOMKIT_COLOR_RESET}"
}
