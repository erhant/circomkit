use std::collections::HashMap;
use std::path::Path;

use num_bigint::BigUint;

use super::primes::prime_from_value;
use crate::error::{CoreError, Result};
use crate::types::{R1CSFile, R1CSInfo};

/// Read circuit information from an R1CS binary file (header only).
///
/// Follows the spec at <https://github.com/iden3/r1csfile/blob/master/doc/r1cs_bin_format.md>.
pub fn read_r1cs_info(path: &Path) -> Result<R1CSInfo> {
    let buffer = std::fs::read(path)?;
    parse_r1cs_info(&buffer)
}

/// Parse R1CS info from a byte buffer.
pub fn parse_r1cs_info(buffer: &[u8]) -> Result<R1CSInfo> {
    let mut pos = 0;

    // Magic: "r1cs" (4 bytes)
    if buffer.len() < 12 || &buffer[pos..pos + 4] != b"r1cs" {
        return Err(CoreError::InvalidR1cs(
            "missing 'r1cs' magic bytes".to_string(),
        ));
    }
    pos += 4;

    // Version (4 bytes LE)
    let version = read_u32(buffer, &mut pos);
    if version != 1 {
        return Err(CoreError::InvalidR1cs(format!(
            "unsupported version: expected 1, got {version}"
        )));
    }

    // Number of sections (4 bytes LE)
    let n_sections = read_u32(buffer, &mut pos);

    let mut info = R1CSInfo {
        wires: 0,
        constraints: 0,
        private_inputs: 0,
        public_inputs: 0,
        public_outputs: 0,
        uses_custom_gates: false,
        labels: 0,
        prime: BigUint::ZERO,
        prime_name: None,
    };

    for _ in 0..n_sections {
        if pos + 12 > buffer.len() {
            break;
        }

        let section_type = read_u32(buffer, &mut pos);
        let section_size = read_u64(buffer, &mut pos) as usize;

        if pos + section_size > buffer.len() {
            return Err(CoreError::InvalidR1cs("section exceeds buffer".to_string()));
        }

        match section_type {
            // Header section
            1 => {
                let field_size = read_u32(buffer, &mut pos) as usize;

                // Prime (field_size bytes, little-endian)
                info.prime = BigUint::from_bytes_le(&buffer[pos..pos + field_size]);
                pos += field_size;

                info.prime_name = prime_from_value(&info.prime);

                info.wires = read_u32(buffer, &mut pos);
                info.public_outputs = read_u32(buffer, &mut pos);
                info.public_inputs = read_u32(buffer, &mut pos);
                info.private_inputs = read_u32(buffer, &mut pos);
                info.labels = read_u64(buffer, &mut pos);
                info.constraints = read_u32(buffer, &mut pos);
            }
            // Custom gates list (PLONK)
            4 => {
                info.uses_custom_gates = read_u32(buffer, &mut pos) > 0;
                // Skip the rest of this section
                pos += section_size - 4;
            }
            // Skip other sections
            _ => {
                pos += section_size;
            }
        }
    }

    Ok(info)
}

/// Read and fully parse a binary `.r1cs` file, including constraints.
///
/// The `chunk_to_elem` closure converts raw little-endian coefficient bytes (`n8` bytes)
/// into the target field element type `T`. This follows the same pattern as
/// [`parse_witness_to_elems`](super::witness::parse_witness_to_elems), enabling zero-cost
/// abstraction over different backends (BigInt, arkworks, lambdaworks).
pub fn read_r1cs_file<T>(path: &Path, chunk_to_elem: impl Fn(&[u8]) -> T) -> Result<R1CSFile<T>> {
    let buffer = std::fs::read(path)?;
    parse_r1cs_bytes(&buffer, chunk_to_elem)
}

/// Parse a full R1CS from a byte buffer, including constraints.
///
/// See [`read_r1cs_file`] for details on the `chunk_to_elem` closure.
pub fn parse_r1cs_bytes<T>(
    buffer: &[u8],
    chunk_to_elem: impl Fn(&[u8]) -> T,
) -> Result<R1CSFile<T>> {
    let mut pos = 0;

    // Magic: "r1cs" (4 bytes)
    if buffer.len() < 12 || &buffer[pos..pos + 4] != b"r1cs" {
        return Err(CoreError::InvalidR1cs(
            "missing 'r1cs' magic bytes".to_string(),
        ));
    }
    pos += 4;

    // Version (4 bytes LE)
    let version = read_u32(buffer, &mut pos);
    if version != 1 {
        return Err(CoreError::InvalidR1cs(format!(
            "unsupported version: expected 1, got {version}"
        )));
    }

    // Number of sections (4 bytes LE)
    let n_sections = read_u32(buffer, &mut pos);

    // First pass: collect section offsets
    let mut section_offsets: HashMap<u32, (usize, usize)> = HashMap::new();
    for _ in 0..n_sections {
        if pos + 12 > buffer.len() {
            return Err(CoreError::InvalidR1cs("unexpected end of file".to_string()));
        }
        let section_type = read_u32(buffer, &mut pos);
        let section_size = read_u64(buffer, &mut pos) as usize;
        if pos + section_size > buffer.len() {
            return Err(CoreError::InvalidR1cs("section exceeds buffer".to_string()));
        }
        section_offsets.insert(section_type, (pos, section_size));
        pos += section_size;
    }

    // Parse header (section 1)
    let &(header_pos, _) = section_offsets
        .get(&1)
        .ok_or_else(|| CoreError::InvalidR1cs("missing header section".to_string()))?;
    pos = header_pos;

    let n8 = read_u32(buffer, &mut pos) as usize;
    let prime = BigUint::from_bytes_le(&buffer[pos..pos + n8]);
    pos += n8;

    let num_variables = read_u32(buffer, &mut pos) as usize;
    let num_outputs = read_u32(buffer, &mut pos);
    let num_pub_inputs = read_u32(buffer, &mut pos);
    let num_priv_inputs = read_u32(buffer, &mut pos);
    let num_labels = read_u64(buffer, &mut pos);
    let num_constraints = read_u32(buffer, &mut pos) as usize;

    // Parse constraints (section 2)
    let &(constraint_pos, _) = section_offsets
        .get(&2)
        .ok_or_else(|| CoreError::InvalidR1cs("missing constraints section".to_string()))?;
    pos = constraint_pos;

    let constraints = parse_constraints(buffer, &mut pos, num_constraints, n8, &chunk_to_elem)?;

    Ok(R1CSFile {
        n8,
        prime,
        num_variables,
        num_outputs,
        num_pub_inputs,
        num_priv_inputs,
        num_labels,
        num_constraints,
        constraints,
    })
}

/// Parse all constraints from the constraints section.
///
/// Each constraint has three linear combinations (A, B, C).
/// Each linear combination is: count (u32), then count × (wire_index: u32, coefficient: n8 bytes LE).
fn parse_constraints<T>(
    buffer: &[u8],
    pos: &mut usize,
    num_constraints: usize,
    n8: usize,
    chunk_to_elem: &impl Fn(&[u8]) -> T,
) -> Result<Vec<[HashMap<usize, T>; 3]>> {
    let mut constraints = Vec::with_capacity(num_constraints);
    for _ in 0..num_constraints {
        let a = parse_linear_combination(buffer, pos, n8, chunk_to_elem)?;
        let b = parse_linear_combination(buffer, pos, n8, chunk_to_elem)?;
        let c = parse_linear_combination(buffer, pos, n8, chunk_to_elem)?;
        constraints.push([a, b, c]);
    }
    Ok(constraints)
}

/// Parse a single linear combination: a sparse map from wire index to coefficient.
fn parse_linear_combination<T>(
    buffer: &[u8],
    pos: &mut usize,
    n8: usize,
    chunk_to_elem: &impl Fn(&[u8]) -> T,
) -> Result<HashMap<usize, T>> {
    let n_terms = read_u32(buffer, pos) as usize;
    let mut lc = HashMap::with_capacity(n_terms);
    for _ in 0..n_terms {
        let wire_idx = read_u32(buffer, pos) as usize;
        if *pos + n8 > buffer.len() {
            return Err(CoreError::InvalidR1cs(
                "constraint coefficient exceeds buffer".to_string(),
            ));
        }
        let coeff = chunk_to_elem(&buffer[*pos..*pos + n8]);
        *pos += n8;
        lc.insert(wire_idx, coeff);
    }
    Ok(lc)
}

fn read_u32(buffer: &[u8], pos: &mut usize) -> u32 {
    let val = u32::from_le_bytes(buffer[*pos..*pos + 4].try_into().unwrap());
    *pos += 4;
    val
}

fn read_u64(buffer: &[u8], pos: &mut usize) -> u64 {
    let val = u64::from_le_bytes(buffer[*pos..*pos + 8].try_into().unwrap());
    *pos += 8;
    val
}
