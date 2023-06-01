#!/bin/bash

# I couldn't bring myself to delete this file :(

cd "${0%/*}"/.. # get to project root
set -e # abort on error

### load CLI environment variables
# proof system to be used, can be: groth16 | plonk | fflonk
CIRCOMKIT_PROOF_SYSTEM="groth16"
# name of the curve to be used: bn128 | bls12381 | goldilocks
CIRCOMKIT_ELLIPTIC_CURVE="bn128" 
# solidity contract export path
CIRCOMKIT_SOLIDITY_PATH="./contracts"
# compiler args, can add --inspect and -c for example
CIRCOMKIT_COMPILER_ARGS="--r1cs --wasm --sym -l ./node_modules -p $CIRCOMKIT_ELLIPTIC_CURVE --inspect"
# circom version
CIRCOMKIT_VERSION="2.1.0"
# colors for swag terminal outputs
CIRCOMKIT_COLOR_TITLE='\033[0;34m' # blue
CIRCOMKIT_COLOR_LOG='\033[2;37m'   # gray
CIRCOMKIT_COLOR_ERR='\033[0;31m'   # red
CIRCOMKIT_COLOR_RESET='\033[0m'    # reset color

### check validness of variables
valid_proof_systems=("groth16" "plonk" "fflonk")
if [[ ! " ${valid_proof_systems[@]} " =~ " ${CIRCOMKIT_PROOF_SYSTEM} " ]]; then
  echo -e "${CIRCOMKIT_COLOR_ERR}Invalid proof system: $CIRCOMKIT_PROOF_SYSTEM${CIRCOMKIT_COLOR_RESET}"
  exit 1
fi
valid_elliptic_curves=("bn128" "bls12381" "goldilocks")
if [[ ! " ${valid_elliptic_curves[@]} " =~ " ${CIRCOMKIT_ELLIPTIC_CURVE} " ]]; then
  echo -e "${CIRCOMKIT_COLOR_ERR}Invalid elliptic curve: $CIRCOMKIT_ELLIPTIC_CURVE${CIRCOMKIT_COLOR_RESET}"
  exit 1
fi 

## Function definitions
# Generate types from a circuit template (incomplete)
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


# Commence a circuit-specific setup
setup() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Circuit Setup ($CIRCOMKIT_PROOF_SYSTEM) ===${CIRCOMKIT_COLOR_RESET}"
  local CIRCUIT=$1                                    # circuit name
  local P1_PTAU=$2                                    # path to phase-1 ptau
  local NUM_CONTRIBS=$3                               # number of contributions (for groth16)
  local CIRCUIT_DIR=./build/$CIRCUIT                  # circuit directory
  local PROVER_KEY=$CIRCUIT_DIR/prover_key.zkey
  local VERIFICATION_KEY=$CIRCUIT_DIR/verifier_key.json

  # check if P1_PTAU exists
  if [ ! -f "$P1_PTAU" ]; then
    echo -e "PTAU file ${CIRCOMKIT_COLOR_ERR}${P1_PTAU} does not exist.${CIRCOMKIT_COLOR_RESET}"
    exit 1
  fi

  if [[ "$CIRCOMKIT_PROOF_SYSTEM" == "groth16" ]]; then
    local P2_PTAU=$CIRCUIT_DIR/phase2_final.ptau         # phase-2 ptau
    local CUR=000                                       # zkey id, initially 0

    # if Groth16, circuit specific ceremony is needed
    # start phase-2 ceremony (circuit specific)
    echo -e "${CIRCOMKIT_COLOR_LOG}this may take a while...${CIRCOMKIT_COLOR_RESET}"
    snarkjs powersoftau prepare phase2 $P1_PTAU $P2_PTAU -v

    # generate a zkey that contains proving and verification keys, along with phase-2 contributions
    snarkjs groth16 setup \
      $CIRCUIT_DIR/$CIRCUIT.r1cs \
      $P2_PTAU \
      $CIRCUIT_DIR/${CIRCUIT}_${CUR}.zkey
    
    # get rid of phase-2 ptau
    rm $P2_PTAU

    # make contributions (001, 002, ...)
    for NEXT in $(seq -f "%03g" 1 ${NUM_CONTRIBS})
    do
      echo "Making Phase-2 Contribution: ${NEXT}"
      snarkjs zkey contribute \
        $CIRCUIT_DIR/${CIRCUIT}_${CUR}.zkey \
        $CIRCUIT_DIR/${CIRCUIT}_${NEXT}.zkey -v

      rm $CIRCUIT_DIR/${CIRCUIT}_${CUR}.zkey

      CUR=$NEXT
    done
    echo "Phase 2 Complete."

    # rename key to the prover key
    mv $CIRCUIT_DIR/${CIRCUIT}_${CUR}.zkey $PROVER_KEY
  else
    # otherwise, we can use that phase-1 ptau alone
    snarkjs $CIRCOMKIT_PROOF_SYSTEM setup $CIRCUIT_DIR/$CIRCUIT.r1cs \
      $P1_PTAU \
      $PROVER_KEY
  fi

  # export
  snarkjs zkey export verificationkey $PROVER_KEY $VERIFICATION_KEY

  echo -e "${CIRCOMKIT_COLOR_LOG}Generated keys\n\tProver key: $PROVER_KEY\n\tVerification key: $VERIFICATION_KEY${CIRCOMKIT_COLOR_RESET}"
}

# Compile the circuit, outputting R1CS and JS files
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


# Clean build files
clean() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Cleaning artifacts ===${CIRCOMKIT_COLOR_RESET}"
  local CIRCUIT=$1
  local CIRCUIT_DIR=./build/$CIRCUIT
  local TARGET=./circuits/main/$CIRCUIT.circom

  rm -rf $CIRCUIT_DIR
  rm -f $TARGET

  echo -e "${CIRCOMKIT_COLOR_LOG}Deleted $CIRCUIT_DIR and $TARGET${CIRCOMKIT_COLOR_RESET}"
}

# Exports a solidity contract for the verifier
contract() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Generating Solidity verifier ===${CIRCOMKIT_COLOR_RESET}" 
  local CIRCUIT=$1
  local CIRCUIT_DIR=./build/$CIRCUIT

  snarkjs zkey export solidityverifier \
    $CIRCUIT_DIR/prover_key.zkey \
    $CIRCUIT_DIR/verifier.sol

  echo -e "${CIRCOMKIT_COLOR_LOG}Contract created at $CIRCUIT_DIR/verifier.sol!${CIRCOMKIT_COLOR_RESET}"
}


# Exports a solidity contract for the verifier
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

# Debug a witness
debug() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Debugging witness ===${CIRCOMKIT_COLOR_RESET}" 
  local CIRCUIT=$1
  local INPUT=$2 
  local CIRCUIT_DIR=./build/$CIRCUIT
  local OUTPUT_DIR=./build/$CIRCUIT/$INPUT      # directory for proof & public signals
  local INPUT_DIR=./inputs/$CIRCUIT             # directory for inputs

  snarkjs wtns debug \
    $CIRCUIT_DIR/${CIRCUIT}_js/$CIRCUIT.wasm \
    $INPUT_DIR/$INPUT.json \
    $OUTPUT_DIR/witness.wtns \
    $CIRCUIT_DIR/$CIRCUIT.sym

  echo -e "${CIRCOMKIT_COLOR_LOG}Done!${CIRCOMKIT_COLOR_RESET}"
}

# Instantiate the main component
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

# Generate a proof
prove() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Generating proof ===${CIRCOMKIT_COLOR_RESET}" 
  local CIRCUIT=$1
  local INPUT=$2 
  local CIRCUIT_DIR=./build/$CIRCUIT
  local OUTPUT_DIR=$CIRCUIT_DIR/$INPUT

  snarkjs $CIRCOMKIT_PROOF_SYSTEM prove \
    $CIRCUIT_DIR/prover_key.zkey \
    $OUTPUT_DIR/witness.wtns \
    $OUTPUT_DIR/proof.json \
    $OUTPUT_DIR/public.json

  echo -e "${CIRCOMKIT_COLOR_LOG}Generated under $OUTPUT_DIR${CIRCOMKIT_COLOR_RESET}"
}

# Verify a witness & proof
verify() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Verifying proof ===${CIRCOMKIT_COLOR_RESET}"
  local CIRCUIT=$1
  local INPUT=$2
  local CIRCUIT_DIR=./build/$CIRCUIT

  snarkjs $CIRCOMKIT_PROOF_SYSTEM verify \
    $CIRCUIT_DIR/verifier_key.json \
    $CIRCUIT_DIR/$INPUT/public.json \
    $CIRCUIT_DIR/$INPUT/proof.json

  echo -e "${CIRCOMKIT_COLOR_LOG}Verification complete.${CIRCOMKIT_COLOR_RESET}"
}

# Calculates the witness for the given circuit and input
witness() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Computing witness ===${CIRCOMKIT_COLOR_RESET}"
  local CIRCUIT=$1
  local INPUT=$2
  local JS_DIR=./build/$CIRCUIT/${CIRCUIT}_js   # JS files for the circuit
  local OUTPUT_DIR=./build/$CIRCUIT/$INPUT      # directory for proof & public signals
  local INPUT_DIR=./inputs/$CIRCUIT             # directory for inputs
  local WITNESS=$OUTPUT_DIR/witness.wtns        # witness output

  mkdir -p $OUTPUT_DIR
 
  node $JS_DIR/generate_witness.js \
    $JS_DIR/$CIRCUIT.wasm \
    $INPUT_DIR/$INPUT.json \
    $WITNESS

  echo -e "${CIRCOMKIT_COLOR_LOG}Generated\n\tWitness: $WITNESS${CIRCOMKIT_COLOR_RESET}"
}

## CLI
# default values
NUM_CONTRIBS=1
INPUT="default"
P1_PTAU="./ptau/powersOfTau28_hez_final_12.ptau"

# get arguments
while getopts "f:c:n:i:p:d:" opt; do
  case $opt in
    # function to call
    f) 
      FUNC="$OPTARG"
      ;;
    # circuit name
    c) 
      CIRCUIT="$OPTARG"
      ;;
    # number of contributions
    n) 
      NUM_CONTRIBS="$OPTARG"
      ;;
    # input name
    i) 
      INPUT="$OPTARG"
      ;;
    # phase-1 ptau path
    p) 
      P1_PTAU="$OPTARG"
      ;;
    # invalid option
    \?) 
      echo "Invalid option -$OPTARG" >&2
      exit 1
      ;; 
  esac
      
  case $OPTARG in
    -*) echo "Option $opt needs a valid argument"
    exit 1
    ;;
  esac
done

# parse circuit & input paths via basename
# TODO, maybe not needed
CIRCUIT=$(basename $CIRCUIT .circom)
INPUT=$(basename $INPUT .json)

case $FUNC in
  clean)
    clean $CIRCUIT
    ;;
  contract) 
    contract $CIRCUIT
    ;;
  calldata) 
    calldata $CIRCUIT $INPUT
    ;;
  compile) 
    instantiate $CIRCUIT && compile $CIRCUIT
    ;;
  debug) 
    debug $CIRCUIT $INPUT
    ;;
  instantiate) 
    instantiate $CIRCUIT
    ;;
  type) 
    type $CIRCUIT
    ;;
  setup) 
    setup $CIRCUIT $P1_PTAU $NUM_CONTRIBS
    ;;
  keygen) 
    compile $CIRCUIT && setup $CIRCUIT $P1_PTAU $NUM_CONTRIBS
    ;;
  prove) 
    witness $CIRCUIT $INPUT && prove $CIRCUIT $INPUT
    ;;
  witness) 
    witness $CIRCUIT $INPUT
    ;;
  verify) 
    verify $CIRCUIT $INPUT
    ;;
  *) 
    echo "Usage:"
    echo "  -f <function>"
    echo "    clean        Cleans the build artifacts"
    echo "    contract     Export Solidity verifier"
    echo "    calldata     Export Solidity calldata for verification"
    echo "    compile      Compile the circuit"
    echo "    instantiate  Instantiate the main component"
    echo "    type         Generate types for TypeScript"
    echo "    setup        Phase-2 setup for the circuit"
    echo "    witness      Generate witness from an input"
    echo "    prove        Prove an input"
    echo "    verify       Verify a proof & public signals"
    echo "    keygen       Shorthand for compile & setup"
    echo "  -c <circuit-name>"
    echo "  -n <num-contributions> (default: $NUM_CONTRIBS)"
    echo "  -i <input-name>"
    echo "  -p <phase1-ptau-path>"
    ;;
esac
