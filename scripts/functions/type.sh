## Parse the symbols file and generate types for TypeScript
type() {
  echo -e "\n${TITLE_COLOR}=== Generating types ===${RESET}" 
  CIRCUIT=$1
  SYM=./build/$CIRCUIT/$CIRCUIT.sym

  # choose lines with 1 dot only (these are the signals in main file)
  LINES=$(cat $SYM | grep -E '^[^.]*\.[^.]*$')
  echo $LINES

  echo -e "\n${LOG_COLOR}Types generated!${RESET}" 
}