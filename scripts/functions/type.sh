## Parse the symbols file and generate types for TypeScript
type() {
  echo -e "\n${CLIENV_COLOR_TITLE}=== Generating types ===${CLIENV_COLOR_RESET}" 
  CIRCUIT=$1
  SYM=./build/$CIRCUIT/$CIRCUIT.sym

  # choose lines with 1 dot only (these are the signals in main file), extract their names
  cat $SYM | grep -E '^.+main[^.]*\.[^.]*$'

  echo -e "\n${CLIENV_COLOR_LOG}Types generated!${CLIENV_COLOR_RESET}" 
}
