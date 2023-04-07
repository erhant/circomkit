## Parse the template circuit that you are using for your main component
## and generate TypeScript interfaces for it
type() {
  set -e

  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Generating types ===${CIRCOMKIT_COLOR_RESET}" 
  local CIRCUIT=$1
  local SYM=./build/$CIRCUIT/$CIRCUIT.sym

  # choose lines with 1 dot only (these are the signals of the main component), extract their names
  local MAIN_SIGNALS=$(cat $SYM | awk -F '.' 'NF==2 {print $2}')

  # get the unique signal names
  local MAIN_SIGNAL_NAMES=$(echo "$MAIN_SIGNALS" | awk -F '[' '{print $1}' | uniq)

  # get the last signal for each signal name
  local SIGNALS=""
  for SIGNAL in $MAIN_SIGNAL_NAMES; do
    SIGNALS+="$(echo "$MAIN_SIGNALS" | grep $SIGNAL | tail -n 1) "
  done
  echo "$SIGNALS"

  echo -e "\n${CIRCOMKIT_COLOR_LOG}Types generated!${CIRCOMKIT_COLOR_RESET}" 
}
