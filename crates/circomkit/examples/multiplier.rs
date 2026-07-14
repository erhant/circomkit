//! End-to-end Circomkit walkthrough using the Rust library API.
//!
//! Mirrors `examples/multiplier/e2e.sh` (the CLI walkthrough), but driven
//! directly through the `circomkit` crate: compile, trusted setup, witness,
//! prove, and verify — against the shared `examples/multiplier` project.
//!
//! Requires `circom` and `snarkjs` on your PATH.
//!
//! Run with:
//! ```sh
//! cargo run -p circomkit --example multiplier
//! ```

use std::path::PathBuf;

use circomkit::Circomkit;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Resolve the shared example project relative to this crate, and run from
    // there so the config's relative paths (./circuits, ./build, ...) resolve.
    let project = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../examples/multiplier")
        .canonicalize()?;
    std::env::set_current_dir(&project)?;

    let ck = Circomkit::from_file("circomkit.json")?;
    let circuit = "multiplier_3";
    let input = "default";

    println!(">> Compiling {circuit}");
    ck.compile(circuit)?;

    let info = ck.info(circuit)?;
    println!(
        "   wires={} constraints={} prime={}",
        info.wires,
        info.constraints,
        info.prime_name.map(|p| p.to_string()).unwrap_or_default(),
    );

    println!(">> Trusted setup (auto-downloads PTAU for bn128)");
    ck.setup(circuit, None)?;
    ck.vkey(circuit)?;

    println!(">> Computing the witness for input '{input}'");
    ck.witness(circuit, input, None)?;

    println!(">> Generating a proof");
    ck.prove(circuit, input, None, None)?;

    println!(">> Verifying the proof");
    let ok = ck.verify(circuit, input)?;
    println!("   proof valid: {ok}");
    assert!(ok, "proof should verify");

    println!("Done. Artifacts under {}/build/{circuit}", project.display());
    Ok(())
}
