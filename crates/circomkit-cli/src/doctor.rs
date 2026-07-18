//! `circomkit doctor` — inspect the environment: external tool versions,
//! OS/arch, CPU, and memory (to gauge the largest usable PTAU).

use std::path::PathBuf;
use std::process::Command;

use regex::Regex;
use sysinfo::System;

const REQUIRED: bool = true;
const OPTIONAL: bool = false;

/// Status of an external tool.
struct ToolStatus {
    name: &'static str,
    /// Why the tool matters (shown when missing).
    note: &'static str,
    required: bool,
    found: bool,
    version: Option<String>,
    path: Option<PathBuf>,
}

/// Full environment report.
struct DoctorReport {
    os: &'static str,
    arch: &'static str,
    cpu_cores: Option<usize>,
    total_memory: u64,
    available_memory: u64,
    max_ptau_power: u32,
    tools: Vec<ToolStatus>,
}

impl DoctorReport {
    fn gather() -> Self {
        let mut sys = System::new();
        sys.refresh_memory();
        let total_memory = sys.total_memory();

        DoctorReport {
            os: std::env::consts::OS,
            arch: std::env::consts::ARCH,
            cpu_cores: std::thread::available_parallelism().ok().map(|n| n.get()),
            total_memory,
            available_memory: sys.available_memory(),
            max_ptau_power: max_ptau_power(total_memory),
            tools: vec![
                tool("circom", "--version", REQUIRED, "circuit compiler"),
                tool("snarkjs", "--version", REQUIRED, "proving / setup / verify"),
                tool("node", "--version", OPTIONAL, "runtime for snarkjs"),
                tool(
                    "nasm",
                    "--version",
                    OPTIONAL,
                    "needed for the C witness backend",
                ),
                tool(
                    "make",
                    "--version",
                    OPTIONAL,
                    "needed for the C witness backend",
                ),
            ],
        }
    }

    /// Whether every required tool was found.
    fn all_required_present(&self) -> bool {
        self.tools.iter().all(|t| !t.required || t.found)
    }
}

/// Run the doctor. Returns `true` if all required tools are present.
pub fn run(json: bool) -> bool {
    let report = DoctorReport::gather();
    if json {
        print_json(&report);
    } else {
        print_text(&report);
    }
    report.all_required_present()
}

fn tool(name: &'static str, version_arg: &str, required: bool, note: &'static str) -> ToolStatus {
    let output = Command::new(name).arg(version_arg).output();
    let found = output.is_ok();
    let version = output.ok().and_then(|out| {
        let text = format!(
            "{}{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        );
        extract_version(&text)
    });
    ToolStatus {
        name,
        note,
        required,
        found,
        version,
        path: find_on_path(name),
    }
}

/// First semver-ish token in the text (e.g. `2.2.0` from `circom compiler 2.2.0`).
fn extract_version(text: &str) -> Option<String> {
    let re = Regex::new(r"\d+\.\d+(?:\.\d+)?").unwrap();
    re.find(text).map(|m| m.as_str().to_string())
}

/// Best-effort resolution of an executable on `PATH`.
fn find_on_path(cmd: &str) -> Option<PathBuf> {
    let exe = if cfg!(windows) {
        format!("{cmd}.exe")
    } else {
        cmd.to_string()
    };
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .map(|dir| dir.join(&exe))
            .find(|p| p.is_file())
    })
}

/// Rough upper bound on the PTAU power (2^k constraints) the device can handle,
/// based on total memory.
///
/// Heuristic only: Groth16 setup/proving peak memory scales with the constraint
/// count; this assumes snarkjs-class usage (~2.5 KiB/constraint, 70% of RAM
/// usable). Native backends (arkworks / lambdaworks / rapidsnark) allow larger.
/// Clamped to circomkit's PTAU floor (2^8) and the Perpetual Powers of Tau
/// ceiling (2^28).
fn max_ptau_power(total_memory: u64) -> u32 {
    const BYTES_PER_CONSTRAINT: f64 = 2560.0;
    let usable = total_memory as f64 * 0.7;
    let max_constraints = (usable / BYTES_PER_CONSTRAINT).max(1.0);
    (max_constraints.log2().floor() as i64).clamp(8, 28) as u32
}

/// Human-readable byte size.
fn human_bytes(bytes: u64) -> String {
    const GIB: f64 = 1024.0 * 1024.0 * 1024.0;
    const MIB: f64 = 1024.0 * 1024.0;
    let b = bytes as f64;
    if b >= GIB {
        format!("{:.1} GiB", b / GIB)
    } else {
        format!("{:.0} MiB", b / MIB)
    }
}

fn print_text(r: &DoctorReport) {
    println!("Circomkit doctor\n");

    println!("System");
    println!("  OS:                {} ({})", r.os, r.arch);
    if let Some(cores) = r.cpu_cores {
        println!("  CPU cores:         {cores}");
    }
    println!("  Total memory:      {}", human_bytes(r.total_memory));
    println!("  Available memory:  {}", human_bytes(r.available_memory));
    println!(
        "  Max PTAU power:    ~2^{} (rough estimate; snarkjs-class memory use)",
        r.max_ptau_power
    );

    println!("\nTools");
    for t in &r.tools {
        let mark = if t.found { "[ok]" } else { "[--]" };
        let version = t.version.as_deref().unwrap_or(if t.found {
            "(version unknown)"
        } else {
            "not found"
        });
        let path = t
            .path
            .as_ref()
            .map(|p| format!("  {}", p.display()))
            .unwrap_or_default();
        println!("  {mark} {:<8} {:<18}{path}", t.name, version);
        if !t.found {
            let req = if t.required { "required" } else { "optional" };
            println!("           {req} - {}", t.note);
        }
    }

    if !r.all_required_present() {
        println!("\nSome required tools are missing. Install them and re-run `circomkit doctor`.");
    }
}

fn print_json(r: &DoctorReport) {
    let tools: Vec<_> = r
        .tools
        .iter()
        .map(|t| {
            serde_json::json!({
                "name": t.name,
                "required": t.required,
                "found": t.found,
                "version": t.version,
                "path": t.path.as_ref().map(|p| p.display().to_string()),
            })
        })
        .collect();

    let out = serde_json::json!({
        "os": r.os,
        "arch": r.arch,
        "cpuCores": r.cpu_cores,
        "totalMemoryBytes": r.total_memory,
        "availableMemoryBytes": r.available_memory,
        "maxPtauPower": r.max_ptau_power,
        "allRequiredPresent": r.all_required_present(),
        "tools": tools,
    });
    println!("{}", serde_json::to_string_pretty(&out).unwrap());
}
