#!/bin/bash
## Generate a proof

# abort on error
set -e 

# get to the root directory of this project
cd "${0%/*}"/..

if [[ $# -ne 3 ]]; then
  echo "Usage:"
  echo "$0 <circuit-name> <witness-name> <zkey-id>"
  exit 1
fi

# set variables
CIRCUIT=$1   # circuit name
INPUT=$2     # witness name
ZKEY_ID=$3   # zkey id number, final output from phase-2
CIRCUIT_DIR=./build/$CIRCUIT # circuit directory

snarkjs groth16 prove \
    $CIRCUIT_DIR/zkey/${CIRCUIT}_${ZKEY_ID}.zkey \
    $CIRCUIT_DIR/$INPUT/witness.wtns \
    $CIRCUIT_DIR/$INPUT/proof.json \
    $CIRCUIT_DIR/$INPUT/public.json
echo "Proof generated for the given witness."
