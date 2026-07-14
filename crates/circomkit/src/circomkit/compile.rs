use std::path::PathBuf;

use circomkit_codegen::{MainComponentSpec, instantiate_circuit};
use circomkit_core::enums::WitnessBackend;
use circomkit_core::error::{CoreError, Result};
use circomkit_core::functions::{build_c_witness_binary, compile_circuit};
use circomkit_core::types::R1CSInfo;
use circomkit_core::utils::read_r1cs_info;

use super::Circomkit;

impl Circomkit {
    /// Generate the main component `.circom` file for a circuit.
    pub fn instantiate(&self, circuit: &str) -> Result<PathBuf> {
        let resolved = self.resolve(circuit)?;
        let main_path = self.paths.circuit_main(circuit);
        let c = &resolved.circuit;
        let spec = MainComponentSpec {
            file: &c.file,
            template: &c.template,
            params: &c.params,
            pubs: &c.pubs,
            uses_custom_templates: c.uses_custom_templates,
        };
        instantiate_circuit(&spec, &main_path, &resolved.version)?;
        log::info!("instantiated {circuit} at {}", main_path.display());
        Ok(main_path)
    }

    /// Check whether build artifacts are up-to-date relative to the source file.
    ///
    /// Returns `true` if the R1CS file exists and is newer than both the source
    /// `.circom` file and the generated main component file.
    fn is_build_fresh(&self, circuit: &str, source_file: &str) -> bool {
        let r1cs_path = self.paths.circuit_r1cs(circuit);
        let source_path = self.paths.circuit_source(source_file);
        let main_path = self.paths.circuit_main(circuit);

        let r1cs_mtime = match r1cs_path.metadata().and_then(|m| m.modified()) {
            Ok(t) => t,
            Err(_) => return false,
        };

        // Check source .circom file mtime
        if let Ok(source_mtime) = source_path.metadata().and_then(|m| m.modified())
            && source_mtime > r1cs_mtime
        {
            return false;
        }

        // Check generated main file mtime
        if let Ok(main_mtime) = main_path.metadata().and_then(|m| m.modified())
            && main_mtime > r1cs_mtime
        {
            return false;
        }

        true
    }

    /// Compile a circuit. Auto-instantiates if the main file doesn't exist.
    ///
    /// When `recompile` is `false` (the default), compilation is skipped if the
    /// build artifacts are newer than the source file. Set `recompile` to `true`
    /// to always recompile.
    pub fn compile(&self, circuit: &str) -> Result<PathBuf> {
        let resolved = self.resolve(circuit)?;
        let main_path = self.paths.circuit_main(circuit);

        if !main_path.exists() {
            self.instantiate(circuit)?;
        }

        let out_dir = self.paths.circuit_dir(circuit);
        // TODO: maybe we hide wasm and c compiler options and just enable w.r.t chosen witness config?
        let want_c = self.config.witness.calculator == WitnessBackend::C;
        let c_binary = self.paths.circuit_c_binary(circuit);

        // Skip only when artifacts are fresh AND, for the C backend, the native
        // binary already exists (otherwise we must recompile with `--c`).
        if !resolved.compiler.recompile
            && self.is_build_fresh(circuit, &resolved.circuit.file)
            && !(want_c && !c_binary.exists())
        {
            log::info!("skipping compilation for {circuit} (build is up-to-date)");
            return Ok(out_dir);
        }

        // The C witness backend needs circom's `--c` output; enable it on demand.
        let mut compiler = resolved.compiler.clone();
        if want_c {
            compiler.c = true;
        }
        compile_circuit(&compiler, &main_path, &out_dir)?;

        if want_c {
            build_c_witness_binary(&self.paths.circuit_c_dir(circuit), &c_binary)?;
        }

        log::info!("compiled {circuit} to {}", out_dir.display());
        Ok(out_dir)
    }

    /// Get circuit info from the R1CS file.
    pub fn info(&self, circuit: &str) -> Result<R1CSInfo> {
        let r1cs_path = self.paths.circuit_r1cs(circuit);
        if !r1cs_path.exists() {
            return Err(CoreError::FileNotFound(r1cs_path));
        }
        read_r1cs_info(&r1cs_path)
    }

    /// Remove all build artifacts for a circuit.
    pub fn clear(&self, circuit: &str) -> Result<()> {
        let dir = self.paths.circuit_dir(circuit);
        if dir.exists() {
            std::fs::remove_dir_all(&dir)?;
            log::info!("cleared {}", dir.display());
        }

        let main_path = self.paths.circuit_main(circuit);
        if main_path.exists() {
            std::fs::remove_file(&main_path)?;
        }

        Ok(())
    }
}
