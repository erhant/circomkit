#!/bin/bash

cd "${0%/*}"/.. # get to project root (TODO make this an assertion that pwd is here)
set -e # abort on error

# load CLI environment variables
source ./.cli.env

# import functions
source ./scripts/functions/type.sh
source ./scripts/functions/ptau.sh
source ./scripts/functions/clean.sh
source ./scripts/functions/prove.sh
source ./scripts/functions/verify.sh
source ./scripts/functions/witness.sh
source ./scripts/functions/compile.sh

# get arguments
NUM_CONTRIBS=1 # default value
while getopts "f:c:n:i:p:" opt; do
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

# parse circuit & input paths if required
# TODO

case $FUNC in
  clean) 
    clean $CIRCUIT
    ;;
  compile) 
    compile $CIRCUIT
    ;;
  type) 
    type $CIRCUIT
    ;;
  ptau) 
    ptau $CIRCUIT $NUM_CONTRIBS $P1_PTAU
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
  keygen) 
    compile $CIRCUIT && ptau $CIRCUIT $NUM_CONTRIBS
    ;;
  *) 
    echo "Usage:"
    echo "  -f <function>"
    echo "    clean    Cleans the build artifacts"
    echo "    compile  Compile the circuit"
    echo "    type     Generate types for TypeScript"
    echo "    ptau     Phase-2 setup for the circuit"
    echo "    witness  Generate witness from an input"
    echo "    prove    Prove an input"
    echo "    verify   Verify a proof & public signals"
    echo "  -c <circuit-name>"
    echo "  -n <num-contributions> (default: 1)"
    echo "  -i <input-name>"
    echo "  -p <phase1-ptau-path>"
    ;;
esac
