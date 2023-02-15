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

rm -rf ./build/$CIRCUIT
