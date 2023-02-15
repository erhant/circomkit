#!/bin/bash
## Computes the witness for the given circuit and input.

# abort on error
set -e 

# get to the root directory of this project
cd "${0%/*}"/..

# circuit & input name given as command line arguments
if [[ $# -ne 2 ]]; then
  echo "Usage:"
  echo "$0 <circuit-name> <input-name>"
  exit 1
fi
 
# variables
CIRCUIT=$1                                    # circuit name
INPUT=$2                                      # input JSON name
JSDIR=./build/${CIRCUIT}/${CIRCUIT}_js        # directory of JS files for the circuit
INPUT_JSON=./inputs/${CIRCUIT}/${INPUT}.json  # input JSON file for the witness
WITNESS_OUT_DIR=./build/${CIRCUIT}/${INPUT}   # output directory of the witness

mkdir -p $WITNESS_OUT_DIR
node $JSDIR/generate_witness.js $JSDIR/${CIRCUIT}.wasm $INPUT_JSON $WITNESS_OUT_DIR/witness.wtns
echo "Created $WITNESS_OUTPUT using input $INPUT_JSON"
