#!/bin/bash
## Compile the circuit, outputting R1CS and JS files.

# abort on error
set -e 

# get to the root directory of this project
cd "${0%/*}"/..

if [[ $# -ne 1 ]] ; then
  echo "Usage:"
  echo "$0 <circuit-name>"
  exit 1
fi
CIRCUIT=$1

# variables
CIRCOM_IN=./circuits/$CIRCUIT.circom
CIRCOM_OUT=./build/$CIRCUIT
CIRCOM_LINK=./node_modules

# create build dir if not exists already
mkdir -p $CIRCOM_OUT

# compile
circom $CIRCOM_IN -o $CIRCOM_OUT --r1cs --wasm -l $CIRCOM_LINK
echo "Compiled $CIRCOM_IN under $CIRCOM_OUT"
