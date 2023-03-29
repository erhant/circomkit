## Parse the template circuit that you are using for your main component
## and generate TypeScript interfaces for it
## TODO: not sure i need this yet
type() {
  set -e

  echo -e "\n${CLIENV_COLOR_TITLE}=== Generating types ===${CLIENV_COLOR_RESET}" 
  local CIRCUIT=$1
  local SYM=./build/$CIRCUIT/$CIRCUIT.sym
  local TMP=./scripts/utils.tmp.txt

  # choose lines with 1 dot only (these are the signals of the main component), extract their names
  cat $SYM | awk -F '.' '{print $2}'

  echo -e "\n${CLIENV_COLOR_LOG}Types generated!${CLIENV_COLOR_RESET}" 
}

 # cat ./build/multiplier3/multiplier3.sym | awk -F '.' 'NF==2{print $2}'
