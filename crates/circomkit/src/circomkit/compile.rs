use std::path::PathBuf;

use std::collections::HashMap;

use circomkit_codegen::{
    MainComponentSpec, Template, generate_tag_wrapper_with_suffix, instantiate_circuit, parse_file,
    scaffold_input,
};
use circomkit_core::enums::WitnessBackend;
use circomkit_core::error::{CoreError, Result};
use circomkit_core::functions::{build_c_witness_binary, compile_circuit};
use circomkit_core::types::R1CSInfo;
use circomkit_core::utils::read_r1cs_info;

use super::Circomkit;

/// Name suffix of auto-generated tag wrappers (unlikely to clash with user templates).
const TAG_WRAPPER_SUFFIX: &str = "_circomkit_main";

impl Circomkit {
    /// Parse the circuit's source file and return its configured template's
    /// interface (signals, tags, params).
    ///
    /// Only the circuit's own file is parsed, so a template defined in an
    /// included file is reported as not found.
    pub fn template_interface(&self, circuit: &str) -> Result<Template> {
        let c = self.resolve(circuit)?.circuit;
        let source = self.paths.circuit_source(&c.file);
        let program = parse_file(&source)
            .map_err(|e| CoreError::Codegen(format!("parsing {}: {e}", source.display())))?;
        program.template(&c.template).cloned().ok_or_else(|| {
            CoreError::Codegen(format!(
                "template `{}` not found in {}",
                c.template,
                source.display()
            ))
        })
    }

    /// Generate the tag wrapper used as `main` for a template with tagged inputs.
    ///
    /// `component main` can't have tagged inputs, so the wrapper takes plain
    /// inputs, tags them, and forwards to the template. Its parameters are the
    /// template's own parameters followed by one value per distinct tag.
    pub fn tag_wrapper(&self, circuit: &str) -> Result<String> {
        let template = self.template_interface(circuit)?;
        generate_tag_wrapper_with_suffix(&template, TAG_WRAPPER_SUFFIX)
            .map_err(|e| CoreError::Codegen(e.to_string()))
    }

    /// Build a zero-filled input JSON object with the right signal names and
    /// array shapes, using the circuit's configured integer `params`.
    pub fn scaffold_input(&self, circuit: &str) -> Result<serde_json::Value> {
        let c = self.resolve(circuit)?.circuit;
        let template = self.template_interface(circuit)?;
        let params: HashMap<String, i64> = template
            .params
            .iter()
            .zip(&c.params)
            .filter_map(|(name, value)| Some((name.clone(), value.as_i64()?)))
            .collect();
        scaffold_input(&template, &params).map_err(|e| CoreError::Codegen(e.to_string()))
    }

    /// Generate the main component `.circom` file for a circuit.
    ///
    /// If the template has tagged inputs, a tag wrapper (see [`Self::tag_wrapper`])
    /// is emitted into the main file and instantiated instead, so the circuit's
    /// `params` must also carry the tag values.
    pub fn instantiate(&self, circuit: &str) -> Result<PathBuf> {
        let resolved = self.resolve(circuit)?;
        let main_path = self.paths.circuit_main(circuit);
        let c = &resolved.circuit;

        // ponytail: an unparsable source just skips auto-wrapping; circom will
        // report real syntax errors at compile time.
        let wrapper = match self.tag_wrapper(circuit) {
            Ok(w) => Some(w),
            Err(e) => {
                log::debug!("no tag wrapper for {circuit}: {e}");
                None
            }
        };
        let template = match wrapper {
            Some(_) => format!("{}{TAG_WRAPPER_SUFFIX}", c.template),
            None => c.template.clone(),
        };

        let spec = MainComponentSpec {
            file: &c.file,
            template: &template,
            params: &c.params,
            pubs: &c.pubs,
            uses_custom_templates: c.uses_custom_templates,
            wrapper: wrapper.as_deref(),
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

    /// Compile a circuit, (re)generating its main component first.
    ///
    /// When `recompile` is `false` (the default), compilation is skipped if the
    /// build artifacts are newer than both the source file and the generated
    /// main component. Regenerating the main component is idempotent, so a
    /// changed template/params invalidates the cache while an unchanged config
    /// reuses the build. Set `recompile` to `true` to always recompile.
    pub fn compile(&self, circuit: &str) -> Result<PathBuf> {
        let resolved = self.resolve(circuit)?;

        // Always (re)generate the main component. The write is idempotent, so an
        // unchanged config keeps the same mtime (freshness cache stays valid),
        // while a changed template/params bumps the mtime and forces a recompile
        // below — this is what lets one circuit name be reused for different
        // templates across tests.
        let main_path = self.instantiate(circuit)?;

        let out_dir = self.paths.circuit_dir(circuit);
        // circom's `--c` output is only needed by the C witness backend.
        let want_c = self.config.witness.calculator == WitnessBackend::C;
        let c_binary = self.paths.circuit_c_binary(circuit);

        // Skip only when artifacts are fresh AND, for the C backend, the native
        // binary already exists (otherwise we must recompile with `--c`).
        #[expect(clippy::nonminimal_bool)]
        if !resolved.compiler.recompile
            && self.is_build_fresh(circuit, &resolved.circuit.file)
            && !(want_c && !c_binary.exists())
        {
            log::info!("skipping compilation for {circuit} (build is up-to-date)");
            return Ok(out_dir);
        }

        compile_circuit(&resolved.compiler, &main_path, &out_dir, want_c)?;

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
