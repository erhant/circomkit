use std::path::{Path, PathBuf};

use crate::error::{CoreError, Result};

/// Base URL for Hermez PTAU files.
const PTAU_BASE_URL: &str = "https://storage.googleapis.com/zkevm/ptau";

/// Determine the PTAU file name for a given constraint count.
///
/// Finds the smallest power of 2 such that `2^p >= constraints`,
/// then returns the corresponding PTAU filename.
pub fn ptau_name_for_constraints(constraints: u32) -> String {
    let mut power = 1u32;
    let mut exp = 0u32;
    while power < constraints {
        power = power.saturating_mul(2);
        exp += 1;
    }
    // Minimum PTAU is 2^1
    exp = exp.max(1);
    format!("powersOfTau28_hez_final_{exp:02}.ptau")
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
        assert_eq!(
            ptau_name_for_constraints(1),
            "powersOfTau28_hez_final_01.ptau"
        );
        assert_eq!(
            ptau_name_for_constraints(2),
            "powersOfTau28_hez_final_01.ptau"
        );
        assert_eq!(
            ptau_name_for_constraints(3),
            "powersOfTau28_hez_final_02.ptau"
        );
        assert_eq!(
            ptau_name_for_constraints(1024),
            "powersOfTau28_hez_final_10.ptau"
        );
        assert_eq!(
            ptau_name_for_constraints(1025),
            "powersOfTau28_hez_final_11.ptau"
        );
    }
}
