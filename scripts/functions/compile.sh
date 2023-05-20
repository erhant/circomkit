## Compile the circuit, outputting R1CS and JS files
compile() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Compiling the circuit ===${CIRCOMKIT_COLOR_RESET}"
  local CIRCUIT=$1
  local CIRCOM_IN=./circuits/main/$CIRCUIT.circom
  local CIRCOM_OUT=./build/$CIRCUIT
  
  # create build dir if not exists already
  mkdir -p $CIRCOM_OUT

  # compile with circom
  echo "circom $CIRCOM_IN -o $CIRCOM_OUT $CIRCOMKIT_COMPILER_ARGS"
  circom $CIRCOM_IN -o $CIRCOM_OUT $CIRCOMKIT_COMPILER_ARGS

  echo -e "${CIRCOMKIT_COLOR_LOG}Built artifacts under $CIRCOM_OUT${CIRCOMKIT_COLOR_RESET}"
}
