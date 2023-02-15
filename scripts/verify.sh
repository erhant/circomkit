#!/bin/bash
## Verify

# abort on error
set -e 

# get to the root directory of this project
cd "${0%/*}"/..

if [[ $# -ne 2 ]]; then
  echo "Usage:"
  echo "$0 <circuit-name> <witness-name>"
  exit 1
fi

# set variables
CIRCUIT=$1  # circuit name
INPUT=$2    # witness name 
CIRCUIT_DIR=./build/${CIRCUIT} # circuit directory

# verify
snarkjs groth16 verify \
  ${CIRCUIT_DIR}/verification_key.json \
  ${CIRCUIT_DIR}/${INPUT}/public.json \
  ${CIRCUIT_DIR}/${INPUT}/proof.json
echo "Verification complete."
