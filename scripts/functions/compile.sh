## Compile the circuit, outputting R1CS and JS files
compile() {
  echo -e "\n${TITLE_COLOR}=== Compiling the circuit ===${RESET}"
  local CIRCUIT=$1
  local CIRCOM_IN=./circuits/main/$CIRCUIT.circom
  local CIRCOM_OUT=./build/$CIRCUIT

  echo "Compiler: $CLIENV_COMPILER_ARGS"

  # create build dir if not exists already
  mkdir -p $CIRCOM_OUT

  # compile with circom
  circom $CIRCOM_IN -o $CIRCOM_OUT --r1cs --sym --wasm

  echo -e "${LOG_COLOR}Built artifacts under $CIRCOM_OUT${RESET}"
}
