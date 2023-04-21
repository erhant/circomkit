## Commence a circuit-specific phase-2 powers-of-tau ceremony
setup() {
  echo -e "\n${CIRCOMKIT_COLOR_TITLE}=== Circuit Setup ($CIRCOMKIT_PROOF_SYSTEM) ===${CIRCOMKIT_COLOR_RESET}"
  local CIRCUIT=$1                                    # circuit name
  local P1_PTAU=$2                                    # path to phase-1 ptau
  local NUM_CONTRIBS=$3                               # number of contributions (for groth16)
  local CIRCUIT_DIR=./build/$CIRCUIT                  # circuit directory
  local PROVER_KEY=$CIRCUIT_DIR/prover_key.zkey
  local VERIFICATION_KEY=$CIRCUIT_DIR/verification_key.json

  # check if P1_PTAU exists
  if [ ! -f "$P1_PTAU" ]; then
    echo -e "${CIRCOMKIT_COLOR_ERR}${P1_PTAU} does not exist.${CIRCOMKIT_COLOR_RESET}"
    exit 1
  fi

  if [[ "$CIRCOMKIT_PROOF_SYSTEM" == "groth16" ]]; then
    local P2_PTAU=$CIRCUIT_DIR/phase2_final.ptau         # phase-2 ptau
    local CUR=000                                       # zkey id, initially 0

    # if Groth16, circuit specific ceremony is needed
    # start phase-2 ceremony (circuit specific)
    echo -e "${CIRCOMKIT_COLOR_LOG}this may take a while...${CIRCOMKIT_COLOR_RESET}"
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

    # rename key to the prover key
    mv $CIRCUIT_DIR/${CIRCUIT}_${CUR}.zkey $PROVER_KEY
  else
    # otherwise, we can use that phase-1 ptau alone
    snarkjs $CIRCOMKIT_PROOF_SYSTEM setup $CIRCUIT_DIR/$CIRCUIT.r1cs \
      $P1_PTAU \
      $PROVER_KEY
  fi

  # export
  snarkjs zkey export verificationkey $PROVER_KEY $VERIFICATION_KEY

  echo -e "${CIRCOMKIT_COLOR_LOG}Generated keys\n\tProver key: $PROVER_KEY\n\tVerification key: $VERIFICATION_KEY${CIRCOMKIT_COLOR_RESET}"
}
