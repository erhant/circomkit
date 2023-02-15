#!/bin/bash

# colors for better readability
BLUE='\033[0;34m'
GRAY='\033[2;37m'
RESET='\033[0m'

# abort on error
set -e 

# get to the root directory of this project
cd "${0%/*}"/..

# read circuit & input name given as command line arguments
if [[ $# -ne 2 ]]; then
  echo "Usage:"
  echo "$0 <circuit-name> <input-name>"
  exit 1
fi
CIRCUIT=$1
INPUT=$2 

####### (1) compile | Compile the circuit ############################
CIRCOM_IN=./circuits/$CIRCUIT.circom # circuit path
CIRCOM_LINK=./node_modules           # linked directories
CIRCUIT_DIR=./build/$CIRCUIT         # output directory for artifacts

echo -e "\n${BLUE}=== Compiling the circuit ===${RESET}"
mkdir -p $CIRCUIT_DIR
circom $CIRCOM_IN --r1cs --wasm \
  -o $CIRCUIT_DIR \
  -l $CIRCOM_LINK
echo -e "${GRAY}Built artifacts under $CIRCOM_OUT${RESET}"


####### (2) ptau-phase2 | Commence the circuit-specific ceremony #####
P1_PTAU=./ptau/powersOfTau28_hez_final_12.ptau # phase-1 ptau
P2_PTAU=$CIRCUIT_DIR/pot12_final.ptau # phase-2 ptau
NUM_CONTRIBS=1                       # number of contributions
CUR=000                              # zkey id, initially 000

echo -e "\n${BLUE}=== Phase-2 PTAU (bn128) & Generating VKEY ===${RESET}"
echo -e "${GRAY}this will take a while...${RESET}"
snarkjs powersoftau prepare phase2 \
  $P1_PTAU $P2_PTAU

# generate a zkey that contains proving and verification keys, along with phase-2 contributions
snarkjs groth16 setup \
  $CIRCUIT_DIR/$CIRCUIT.r1cs \
  $P2_PTAU \
  $CIRCUIT_DIR/${CIRCUIT}_$CUR.zkey

# get rid of phase-2 ptau
rm $P2_PTAU

# contribute
for NEXT in $(seq -f "%03g" 1 ${NUM_CONTRIBS})
do
  echo -e "${GRAY}Making Phase-2 Contribution: ${NEXT}${RESET}"

  # make a contribution, with fixed entropy for testing purposes
  snarkjs zkey contribute \
    $CIRCUIT_DIR/${CIRCUIT}_${CUR}.zkey \
    $CIRCUIT_DIR/${CIRCUIT}_${NEXT}.zkey \
    -e="not an entropy"

  # remove intermediate output
  rm $CIRCUIT_DIR/${CIRCUIT}_${CUR}.zkey

  # update current id
  CUR=$NEXT
done

# rename key
mv $CIRCUIT_DIR/${CIRCUIT}_${CUR}.zkey $CIRCUIT_DIR/prover_key.zkey

# export verification key
PROVER_KEY=$CIRCUIT_DIR/prover_key.zkey
VERIFICATION_KEY=${CIRCUIT_DIR}/verification_key.json
snarkjs zkey export verificationkey $PROVER_KEY $VERIFICATION_KEY

echo -e "${GRAY}Generated\n\tProver key: $PROVER_KEY\n\tVerification key: $VERIFICATION_KEY${RESET}"

####### (3) witness | Compute witness #####
JS_DIR=$CIRCUIT_DIR/${CIRCUIT}_js   # JS files for the circuit
PROOF_DIR=$CIRCUIT_DIR/$INPUT       # directory for proof & public signals
WITNESS=$PROOF_DIR/witness.wtns     # witness path

echo -e "\n${BLUE}=== Computing witness ===${RESET}"
mkdir -p $PROOF_DIR
node $JS_DIR/generate_witness.js \
     $JS_DIR/$CIRCUIT.wasm \
     ./inputs/$CIRCUIT/$INPUT.json \
     $WITNESS
echo -e "${GRAY}Generated\n\tWitness: $WITNESS${RESET}"

####### (4) prove | Generate proof #####
PROOF=$PROOF_DIR/proof.json           # proof path
PUB_SIGNAL=$PROOF_DIR/public.json     # public signals path

echo -e "\n${BLUE}=== Generating proof ===${RESET}"
snarkjs groth16 prove \
  $PROVER_KEY \
  $PROOF_DIR/witness.wtns \
  $PROOF \
  $PUB_SIGNAL
echo -e "${GRAY}Generated\n\tProof: $PROOF\n\tPublic: $PUB_SIGNAL${RESET}"

####### (5) verify | Verify the generated proof #####
echo -e "\n${BLUE}=== Verifying proof ===${RESET}"
snarkjs groth16 verify $VERIFICATION_KEY $PUB_SIGNAL $PROOF
echo -e "${GRAY}Verification complete.\n${RESET}"

