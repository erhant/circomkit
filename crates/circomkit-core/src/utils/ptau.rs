use std::path::{Path, PathBuf};

use crate::error::{CoreError, Result};

/// Base URL for Hermez PTAU files.
const PTAU_BASE_URL: &str = "https://storage.googleapis.com/zkevm/ptau";

/// Determine the PTAU file name for a given constraint count.
///
/// Ports the reference Circomkit `getPtauName`: takes `p = ceil(log2(n))`, the
/// smallest power such that `2^p >= n`, then floors at power 8. The floor keeps
/// small circuits off the tiny (fragile) PTAU files and gives snarkjs the extra
/// domain headroom it needs — its own requirement is
/// `floor(log2(nConstraints + nPubInputs + nOutputs)) + 1`, which for small
/// circuits always fits comfortably within `2^8`.
///
/// The Hermez ceremony tops out at `2^28`; larger circuits fall back to the
/// `_{p}` name, which won't be downloadable and surfaces as a download error.
///
/// See <https://github.com/iden3/snarkjs#7-prepare-phase-2>.
pub fn ptau_name_for_constraints(constraints: u32) -> String {
    // ceil(log2(n)): the number of bits needed to represent `n - 1`.
    let p = if constraints <= 1 {
        0
    } else {
        u32::BITS - (constraints - 1).leading_zeros()
    };

    let id = if p < 8 {
        "_08".to_string()
    } else if p < 10 {
        format!("_0{p}")
    } else if p < 28 {
        format!("_{p}")
    } else if p == 28 {
        String::new()
    } else {
        format!("_{p}")
    };
    format!("powersOfTau28_hez_final{id}.ptau")
}

/// Download a PTAU file if it doesn't already exist.
///
/// Only available for BN128 prime. Returns the path to the PTAU file.
#[cfg(feature = "download")]
pub fn download_ptau(ptau_name: &str, ptau_dir: &Path) -> Result<PathBuf> {
    let ptau_path = ptau_dir.join(ptau_name);

    if ptau_path.exists() {
        log::info!("PTAU already exists: {}", ptau_path.display());
        return Ok(ptau_path);
    }

    std::fs::create_dir_all(ptau_dir)?;

    let url = format!("{PTAU_BASE_URL}/{ptau_name}");
    log::info!("downloading PTAU from {url}");

    let response = ureq::get(&url)
        .call()
        .map_err(|e| CoreError::PtauDownloadFailed(e.to_string()))?;

    let mut reader = response.into_reader();
    let mut file = std::fs::File::create(&ptau_path)?;
    std::io::copy(&mut reader, &mut file)?;

    log::info!("PTAU saved to {}", ptau_path.display());
    Ok(ptau_path)
}

/// Check if a PTAU file exists at the expected path (without downloading).
pub fn ptau_path_if_exists(ptau_name: &str, ptau_dir: &Path) -> Option<PathBuf> {
    let path = ptau_dir.join(ptau_name);
    path.exists().then_some(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    // TODO: add ignored tests for `download_ptau` that actually download the file

    #[test]
    fn ptau_naming() {
        // Small circuits floor at power 8, matching reference Circomkit.
        assert_eq!(
            ptau_name_for_constraints(0),
            "powersOfTau28_hez_final_08.ptau"
        );
        assert_eq!(
            ptau_name_for_constraints(1),
            "powersOfTau28_hez_final_08.ptau"
        );
        assert_eq!(
            ptau_name_for_constraints(8),
            "powersOfTau28_hez_final_08.ptau"
        );
        assert_eq!(
            ptau_name_for_constraints(256),
            "powersOfTau28_hez_final_08.ptau"
        );
        // ceil(log2(257)) = 9 → single-digit tier keeps the leading zero.
        assert_eq!(
            ptau_name_for_constraints(257),
            "powersOfTau28_hez_final_09.ptau"
        );
        // ceil(log2(1024)) = 10 → two-digit tier.
        assert_eq!(
            ptau_name_for_constraints(1024),
            "powersOfTau28_hez_final_10.ptau"
        );
        assert_eq!(
            ptau_name_for_constraints(1025),
            "powersOfTau28_hez_final_11.ptau"
        );
        // The largest ceremony (2^28) uses the base file name.
        assert_eq!(
            ptau_name_for_constraints(1 << 28),
            "powersOfTau28_hez_final.ptau"
        );
    }
}
