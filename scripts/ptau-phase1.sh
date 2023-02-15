#!/bin/bash
## Commence a universal phase-1 powers-of-tau ceremony

# abort on error
set -e 

# get to the root directory of this project
cd "${0%/*}"/..

if [[ $# -ne 1 ]]; then
  echo "Usage:"
  echo "$0 <num-contributions>"
  exit 1
fi

# set variables
NUM_CONTRIBS=$1          # number of contributions
PTAU_DIR="./build/ptau"  # output directory of ptaus
CUR=0000                 # ptau id, initially 0000  

# create ptau output directory if not exists
mkdir -p $PTAU_DIR

# start phase-1 ceremony
echo "Starting Powers of Tau ceremony."
snarkjs powersoftau new bn128 12 ${PTAU_DIR}/pot12_${CUR}.ptau -v

# make contributions
for NEXT in $(seq -f "%04g" 1 ${NUM_CONTRIBS})
do
  echo "Making Phase-1 Contribution: ${NEXT}"
  snarkjs powersoftau contribute ${PTAU_DIR}/pot12_${CUR}.ptau ${PTAU_DIR}/pot12_${NEXT}.ptau -v
  rm ${PTAU_DIR}/pot12_${CUR}.ptau
  CUR=$NEXT
done
echo "Phase 1 Complete."
