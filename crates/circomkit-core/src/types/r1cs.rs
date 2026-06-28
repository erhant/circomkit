use std::collections::HashMap;

use num_bigint::BigUint;

use crate::enums::Prime;

/// Information extracted from the R1CS binary header.
#[derive(Debug, Clone)]
pub struct R1CSInfo {
    pub wires: u32,
    pub constraints: u32,
    pub private_inputs: u32,
    pub public_inputs: u32,
    pub public_outputs: u32,
    pub uses_custom_gates: bool,
    pub labels: u64,
    pub prime: BigUint,
    pub prime_name: Option<Prime>,
}

/// A single linear combination: mapping from wire index to coefficient.
pub type LinearCombination<T> = HashMap<usize, T>;

/// A single R1CS constraint: three linear combinations (A, B, C) such that A * B = C.
pub type R1CSConstraint<T> = [LinearCombination<T>; 3];

/// A fully-parsed R1CS file with generic field element type.
///
/// The type parameter `T` is the field element type, determined by the
/// `chunk_to_elem` closure passed to [`parse_r1cs_bytes`](crate::utils::parse_r1cs_bytes).
/// This allows zero-cost abstraction over different backends (BigInt, arkworks, lambdaworks).
#[derive(Debug, Clone)]
pub struct R1CSFile<T> {
    /// Bytes per field element (typically 32).
    pub n8: usize,
    /// Field prime as raw little-endian bytes.
    pub prime: BigUint,
    /// Total number of variables (wires).
    pub num_variables: usize,
    /// Number of public outputs.
    pub num_outputs: u32,
    /// Number of public inputs (excludes the constant wire).
    pub num_pub_inputs: u32,
    /// Number of private inputs.
    pub num_priv_inputs: u32,
    /// Number of labels.
    pub num_labels: u64,
    /// Number of constraints.
    pub num_constraints: usize,
    /// Constraint list: each entry has three sparse linear combinations [A, B, C].
    pub constraints: Vec<R1CSConstraint<T>>,
}
