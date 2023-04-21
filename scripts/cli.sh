#!/bin/bash

cd "${0%/*}"/.. # get to project root (TODO make this an assertion that pwd is here)
set -e # abort on error

# load CLI environment variables
source ./.cli.env

# import functions
source ./scripts/functions/type.sh
source ./scripts/functions/setup.sh
source ./scripts/functions/clean.sh
source ./scripts/functions/contract.sh
source ./scripts/functions/calldata.sh
source ./scripts/functions/prove.sh
source ./scripts/functions/verify.sh
source ./scripts/functions/witness.sh
source ./scripts/functions/compile.sh
source ./scripts/functions/instantiate.sh

# get arguments
NUM_CONTRIBS=1 # default value
COMPILE_DIR="main" # default dir
while getopts "f:c:n:i:p:d:" opt; do
  case $opt in
    # function to call
    f) 
      FUNC="$OPTARG"
      ;;
    # director for compilation (default: main)
    d) 
      COMPILE_DIR="$OPTARG"
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

# parse circuit & input paths if required
# TODO

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
    instantiate $CIRCUIT $COMPILE_DIR && compile $CIRCUIT $COMPILE_DIR
    ;;
  instantiate) 
    instantiate $CIRCUIT $COMPILE_DIR
    ;;
  type) 
    type $CIRCUIT
    ;;
  setup) 
    setup $CIRCUIT $P1_PTAU $NUM_CONTRIBS
    ;;
  keygen) 
    compile $CIRCUIT $COMPILE_DIR && setup $CIRCUIT $P1_PTAU $NUM_CONTRIBS
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
    echo "    setup         Phase-2 setup for the circuit"
    echo "    witness      Generate witness from an input"
    echo "    prove        Prove an input"
    echo "    verify       Verify a proof & public signals"
    echo "    keygen       Shorthand for compile & setup"
    echo "  -c <circuit-name>"
    echo "  -d <directory-name> (default: $COMPILE_DIR)"
    echo "  -n <num-contributions> (default: $NUM_CONTRIBS)"
    echo "  -i <input-name>"
    echo "  -p <phase1-ptau-path>"
    ;;
esac
