//! `circomkit init` — scaffold a minimal project (config, one circuit, one input).

use std::path::Path;

use anyhow::Result;

/// `(relative path, contents)` of every scaffolded file.
const FILES: &[(&str, &str)] = &[
    ("circomkit.json", include_str!("../template/circomkit.json")),
    (
        "circuits/multiplier.circom",
        include_str!("../template/circuits/multiplier.circom"),
    ),
    (
        "inputs/multiplier_3/default.json",
        include_str!("../template/inputs/multiplier_3/default.json"),
    ),
    (".gitignore", include_str!("../template/gitignore")),
];

/// Write the template into `dir`, without overwriting existing files.
pub fn run(dir: &Path) -> Result<()> {
    for (rel, contents) in FILES {
        let path = dir.join(rel);
        if path.exists() {
            println!("skip    {} (already exists)", path.display());
            continue;
        }
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&path, contents)?;
        println!("create  {}", path.display());
    }
    println!("\nCircomkit project initialized! Try: circomkit compile multiplier_3");
    Ok(())
}
