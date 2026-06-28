use std::path::Path;
use std::process::Command;

use crate::config::CompilerConfig;
use crate::error::{CoreError, Result};

/// Output from the circom compilation process.
#[derive(Debug)]
pub struct CompileOutput {
    pub stdout: String,
    pub stderr: String,
}

/// Compile a circuit by invoking the `circom` binary as a subprocess.
pub fn compile_circuit(
    config: &CompilerConfig,
    target_path: &Path,
    out_dir: &Path,
) -> Result<CompileOutput> {
    std::fs::create_dir_all(out_dir)?;

    let mut cmd = Command::new(&config.circom_path);

    // Required flags
    cmd.arg(target_path);
    cmd.args(["-p", &config.prime.to_string()]);
    cmd.args(["-o", &out_dir.to_string_lossy()]);

    // Optional output flags
    if config.r1cs {
        cmd.arg("--r1cs");
    }
    if config.sym {
        cmd.arg("--sym");
    }
    if config.wasm {
        cmd.arg("--wasm");
    }
    if config.c {
        cmd.arg("--c");
    }
    if config.verbose {
        cmd.arg("--verbose");
    }
    if config.inspect {
        cmd.arg("--inspect");
    }

    // Include paths
    for inc in &config.include {
        cmd.args(["-l", &inc.to_string_lossy()]);
    }

    // Optimization level
    if config.optimization > 2 {
        cmd.arg(format!("--O2round {}", config.optimization));
    } else {
        cmd.arg(format!("--O{}", config.optimization));
    }

    log::debug!("running: {:?}", cmd);

    let output = cmd.output()?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(CoreError::CompilationFailed(format!(
            "circom exited with {}\nstderr: {stderr}",
            output.status
        )));
    }

    Ok(CompileOutput { stdout, stderr })
}
