#!/bin/bash
## Parse the .sym file and generate types

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
SYM=./build/$CIRCUIT/$CIRCUIT.sym

# choose lines with 1 dot only
cat $SYM | grep -E '^[^.]*\.[^.]*$'

# TODO
