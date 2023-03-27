## Compile the circuit, outputting R1CS and JS files
compile() {
  echo -e "\n${CLIENV_COLOR_TITLE}=== Compiling the circuit ===${CLIENV_COLOR_RESET}"
  local CIRCUIT=$1
  local CIRCOM_IN=./circuits/main/$CIRCUIT.circom
  local CIRCOM_OUT=./build/$CIRCUIT

  echo "Compiler: $CLIENV_COMPILER_ARGS"

  # create build dir if not exists already
  mkdir -p $CIRCOM_OUT

  # compile with circom
  circom $CIRCOM_IN -o $CIRCOM_OUT --r1cs --sym --wasm

  echo -e "${CLIENV_COLOR_LOG}Built artifacts under $CIRCOM_OUT${CLIENV_COLOR_RESET}"
}
