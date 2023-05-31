## Instantiate the main component
instantiate() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Creating main component ===${CIRCOMKIT_COLOR_RESET}"
  local CIRCUIT=$1

  # parse json for the circuit, trim first and last lines, and then remove all whitespace
  local MATCH=$(sed -n "/ *\"${CIRCUIT}\": *{/, /^  *}[, ]$/p" ./circuits.json | sed '1d;$d' | tr -d "[:space:]")
  if [ -z "$MATCH" ] 
  then
    echo -e "${CIRCOMKIT_COLOR_ERR}No such circuit found!${CIRCOMKIT_COLOR_RESET}" 
    exit
  fi

  # create JSON object
  local JSON_IN="{\"version\":\"${CIRCOMKIT_VERSION}\",$MATCH}"

  # generate the circuit main component
  local OUTDIR="./circuits/main/$CIRCUIT.circom"
  npx ejs ./ejs/template.circom -i $JSON_IN -o $OUTDIR

  echo -e "${CIRCOMKIT_COLOR_LOG}Done!${CIRCOMKIT_COLOR_RESET}"
}
