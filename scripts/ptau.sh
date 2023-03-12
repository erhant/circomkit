#!/bin/bash
## Commence a circuit-specific phase-2 powers-of-tau ceremony

# abort on error
set -e 

# get to the root directory of this project
cd "${0%/*}"/..

if [[ $# -ne 2 ]]; then
  echo "Usage:"
  echo "$0 <circuit-name> <num-contributions>"
  exit 1
fi

# set variables
CIRCUIT=$1                                    # circuit name
NUM_CONTRIBS=$2                               # number of contributions
CIRCUIT_DIR=./build/$CIRCUIT                  # circuit directory
P1_PTAU=./ptau/powersOfTau28_hez_final_12.ptau # input directory of ptaus
P2_PTAU=$CIRCUIT_DIR/pot12_final.ptau          # phase-2 ptau
CUR=000                                       # zkey id, initially 0

# create zkey output directory if not exists
mkdir -p $ZKEY_DIR

# start phase-2 ceremony (circuit specific)
snarkjs powersoftau prepare phase2 $P1_PTAU $P2_PTAU -v

# generate a zkey that contains proving and verification keys, along with phase-2 contributions
snarkjs groth16 setup \
  $CIRCUIT_DIR/$CIRCUIT.r1cs \
  $P2_PTAU \
  $CIRCUIT_DIR/${CIRCUIT}_${CUR}.zkey

# contribute
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

# rename key
mv $CIRCUIT_DIR/${CIRCUIT}_${CUR}.zkey $CIRCUIT_DIR/prover_key.zkey

# export keys
PROVER_KEY=$CIRCUIT_DIR/prover_key.zkey
VERIFICATION_KEY=${CIRCUIT_DIR}/verification_key.json
snarkjs zkey export verificationkey $PROVER_KEY $VERIFICATION_KEY
echo "Exported verification key $VERIFICATION_KEY"

