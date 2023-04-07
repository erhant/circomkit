## Commence a circuit-specific phase-2 powers-of-tau ceremony
ptau() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Phase-2 Powers of Tau ===${CIRCOMKIT_COLOR_RESET}"
  echo -e "${CIRCOMKIT_COLOR_LOG}this may take a while...${CIRCOMKIT_COLOR_RESET}"
  local CIRCUIT=$1                                    # circuit name
  local NUM_CONTRIBS=$2                               # number of contributions
  local P1_PTAU=$3                                    # path to phase-1 ptau
  local CIRCUIT_DIR=./build/$CIRCUIT                  # circuit directory
  local P2_PTAU=$CIRCUIT_DIR/phase2_final.ptau         # phase-2 ptau
  local CUR=000                                       # zkey id, initially 0
  local PROVER_KEY=$CIRCUIT_DIR/prover_key.zkey
  local VERIFICATION_KEY=$CIRCUIT_DIR/verification_key.json

  # check if groth16 is used, as there is no need for phase-2 for plonk
  # TODO

  # check if P1_PTAU exists
  # TODO

  # start phase-2 ceremony (circuit specific)
  snarkjs powersoftau prepare phase2 $P1_PTAU $P2_PTAU -v

  # generate a zkey that contains proving and verification keys, along with phase-2 contributions
  snarkjs groth16 setup \
    $CIRCUIT_DIR/$CIRCUIT.r1cs \
    $P2_PTAU \
    $CIRCUIT_DIR/${CIRCUIT}_${CUR}.zkey
  
  # get rid of phase-2 ptau
  rm $P2_PTAU

  # make contributions (001, 002, ...)
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

  # export
  snarkjs zkey export verificationkey $PROVER_KEY $VERIFICATION_KEY

  echo -e "${CIRCOMKIT_COLOR_LOG}Generated keys\n\tProver key: $PROVER_KEY\n\tVerification key: $VERIFICATION_KEY${CIRCOMKIT_COLOR_RESET}"
}
