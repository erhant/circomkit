/**
 * A label to be used in `console.time`
 */
export const WITNESS_COMP_LABEL = 'Witness computation';

/**
 * Order of the finite field used in Ethereum (BN_254)
 * If you have a number larger than this, you should take the modulus.
 * See: https://docs.circom.io/background/background/#signals-of-a-circuit
 */
export const EVM_FF_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
