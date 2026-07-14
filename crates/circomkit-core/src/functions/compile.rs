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

    let mut cmd = Command::new("circom");

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

/// Build the native C witness calculator binary by running `make` in the
/// circom-generated `{circuit}_cpp` directory.
///
/// Skips the build when `binary_path` is newer than every source file in
/// `cpp_dir` (mtime caching, mirroring the R1CS freshness check). Performs a
/// toolchain preflight (`make`, `nasm`) and, on failure, surfaces `make`'s
/// stderr — with an explicit note on non-x86-64 architectures, where circom's
/// C generator (which emits x86-64 assembly) cannot build.
pub fn build_c_witness_binary(cpp_dir: &Path, binary_path: &Path) -> Result<()> {
    if !cpp_dir.exists() {
        return Err(CoreError::CompilationFailed(format!(
            "C witness source directory not found: {} (did circom run with --c?)",
            cpp_dir.display()
        )));
    }

    if is_c_binary_fresh(cpp_dir, binary_path) {
        log::info!(
            "skipping C witness build ({} is up-to-date)",
            binary_path.display()
        );
        return Ok(());
    }

    // `make` is a ubiquitous system tool; resolve it from PATH rather than
    // making it configurable. `nasm` is invoked by the generated Makefile, so
    // preflight both for a clear error instead of a cryptic build failure.
    ensure_tool_on_path("make")?;
    ensure_tool_on_path("nasm")?;

    log::debug!("running 'make' in {}", cpp_dir.display());
    let output = Command::new("make")
        .current_dir(cpp_dir)
        .output()
        .map_err(|e| CoreError::CompilationFailed(format!("failed to spawn 'make': {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let arch = std::env::consts::ARCH;
        let hint = if arch != "x86_64" {
            format!(
                "\nnote: circom's C witness generator emits x86-64 assembly and does not build \
                 on '{arch}'. Use the WASM witness backend on this architecture."
            )
        } else {
            String::new()
        };
        return Err(CoreError::CompilationFailed(format!(
            "building C witness binary via 'make' failed in {}:\n{stderr}{hint}",
            cpp_dir.display()
        )));
    }

    if !binary_path.exists() {
        return Err(CoreError::CompilationFailed(format!(
            "C witness build reported success but binary not found at {}",
            binary_path.display()
        )));
    }

    Ok(())
}

/// Whether the C witness binary is newer than every source file in `cpp_dir`.
fn is_c_binary_fresh(cpp_dir: &Path, binary_path: &Path) -> bool {
    let bin_mtime = match binary_path.metadata().and_then(|m| m.modified()) {
        Ok(t) => t,
        Err(_) => return false,
    };

    let entries = match std::fs::read_dir(cpp_dir) {
        Ok(e) => e,
        Err(_) => return false,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path == binary_path {
            continue;
        }
        if let Ok(mtime) = path.metadata().and_then(|m| m.modified())
            && mtime > bin_mtime
        {
            return false;
        }
    }
    true
}

/// Return an error if `cmd` is not an executable on `PATH` (or a valid path).
fn ensure_tool_on_path(cmd: &str) -> Result<()> {
    let candidate = Path::new(cmd);
    let found = if candidate.is_absolute() || cmd.contains(std::path::MAIN_SEPARATOR) {
        candidate.exists()
    } else {
        std::env::var_os("PATH")
            .map(|paths| std::env::split_paths(&paths).any(|dir| dir.join(cmd).exists()))
            .unwrap_or(false)
    };

    if found {
        Ok(())
    } else {
        Err(CoreError::CompilationFailed(format!(
            "required tool '{cmd}' not found on PATH (needed to build the C witness binary)"
        )))
    }
}
