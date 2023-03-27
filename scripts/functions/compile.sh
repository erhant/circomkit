## Compile the circuit, outputting R1CS and JS files
compile() {
  echo -e "\n${TITLE_COLOR}=== Compiling the circuit ===${RESET}"
  CIRCUIT=$1
  CIRCOM_IN=./circuits/main/$CIRCUIT.circom
  CIRCOM_OUT=./build/$CIRCUIT

  # create build dir if not exists already
  mkdir -p $CIRCOM_OUT

  # compile with circom
  circom $CIRCOM_IN -o $CIRCOM_OUT --r1cs --sym --wasm -l ./node_modules

  echo -e "${LOG_COLOR}Built artifacts under $CIRCOM_OUT${RESET}"
}
