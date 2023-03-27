#!/bin/bash

cd "${0%/*}"/.. # get to project root (TODO make this an assertion that pwd is here)
set -e # abort on error

# colors for swag
TITLE_COLOR='\033[0;34m' # blue
LOG_COLOR='\033[2;37m' # gray
RESET='\033[0m'

source ./scripts/functions/type.sh
source ./scripts/functions/ptau.sh
source ./scripts/functions/clean.sh
source ./scripts/functions/prove.sh
source ./scripts/functions/verify.sh
source ./scripts/functions/witness.sh
source ./scripts/functions/compile.sh

# get arguments
while getopts "c:n:i:" opt; do
  case $opt in
    # circuit name
    c) 
      CIRCUIT="$OPTARG"
      ;;
    # number of contributions
    n) 
      NUM_CONTRIBS="$OPTARG"
      ;;
    # input name
    i) 
      INPUT="$OPTARG"
      ;;
    # invalid ?
    \?) 
      echo "Invalid option -$OPTARG" >&2
      exit 1
      ;; 
    # invalid ?
    \*) 
      echo "Invalid option -$OPTARG" >&2
      exit 1
      ;; 

  esac
      
  case $OPTARG in
    -*) echo "Option $opt needs a valid argument"
    exit 1
    ;;
  esac
done

# parse circuit & input paths if required
# TODO

echo $CIRCUIT
# case $1 in
#   clean) clean $CIRCUIT
#   ;;
#   compile) compile $CIRCUIT
#   ;;
#   ptau) ptau $CIRCUIT $NUM_CONTRIBS
#   ;;
#   \?) echo "Invalid case" >&2
#   exit 1
#   ;;
# esac

type $CIRCUIT
