use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};

use circomkit::Circomkit;
use circomkit::ProvingBackendKind;

#[derive(Parser)]
#[command(
    name = "circomkit",
    about = "Circom testing & development toolkit",
    version
)]
struct Cli {
    /// Path to circomkit.json config file
    #[arg(long, default_value = "./circomkit.json")]
    config: PathBuf,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Print the effective configuration
    Config,

    /// List all configured circuits
    List,

    /// Compile circuit(s); supports regex patterns to match multiple circuits
    Compile {
        /// Circuit name or regex pattern (e.g. "multiplier.*")
        #[arg(default_value = ".*")]
        pattern: String,
    },

    /// Generate main component file
    Instantiate {
        /// Circuit name
        circuit: String,
    },

    /// Print circuit info (wires, constraints, etc.)
    Info {
        /// Circuit name
        circuit: String,
    },

    /// Remove build artifacts for a circuit
    Clear {
        /// Circuit name
        circuit: String,
    },

    /// Run trusted setup
    Setup {
        /// Circuit name
        circuit: String,
        /// Path to PTAU file (auto-downloads if omitted)
        #[arg(long)]
        ptau: Option<PathBuf>,
    },

    /// Download PTAU file for a circuit
    Ptau {
        /// Circuit name
        circuit: String,
    },

    /// Export verification key
    Vkey {
        /// Circuit name
        circuit: String,
    },

    /// Export Solidity verifier contract
    Contract {
        /// Circuit name
        circuit: String,
    },

    /// Compute witness
    Witness {
        /// Circuit name
        circuit: String,
        /// Input name (loads from inputs/{circuit}/{input}.json)
        input: String,
    },

    /// Generate a proof
    Prove {
        /// Circuit name
        circuit: String,
        /// Input name
        input: String,
        /// Override the proving backend (snarkjs, arkworks, lambdaworks)
        #[arg(long)]
        backend: Option<ProvingBackendKind>,
    },

    /// Verify a proof
    Verify {
        /// Circuit name
        circuit: String,
        /// Input name
        input: String,
    },

    /// Export calldata for Solidity verifier
    Calldata {
        /// Circuit name
        circuit: String,
        /// Input name
        input: String,
        /// Pretty-print Solidity-compatible output
        #[arg(long)]
        pretty: bool,
    },

    /// Export JSON
    Json {
        #[command(subcommand)]
        target: JsonTarget,
    },
}

#[derive(Subcommand)]
enum JsonTarget {
    /// Export R1CS as JSON
    R1cs {
        /// Circuit name
        circuit: String,
    },
}

fn main() -> Result<()> {
    env_logger::init();
    let cli = Cli::parse();

    let ck = Circomkit::from_file(&cli.config)
        .with_context(|| format!("failed to load config from {}", cli.config.display()))?;

    match cli.command {
        Commands::Config => {
            println!("{}", serde_json::to_string_pretty(&ck.config)?);
        }

        Commands::List => {
            if ck.config.circuits.is_empty() {
                println!("No circuits configured.");
            } else {
                let mut names: Vec<_> = ck.config.circuits.keys().collect();
                names.sort();
                for name in names {
                    let config = &ck.config.circuits[name];
                    let params = if config.params.is_empty() {
                        String::new()
                    } else {
                        format!(
                            "({})",
                            config
                                .params
                                .iter()
                                .map(|p| p.to_string())
                                .collect::<Vec<_>>()
                                .join(", ")
                        )
                    };
                    println!("  {name}: {}{params} ({})", config.template, config.file);
                }
            }
        }

        Commands::Compile { pattern } => {
            let re = regex::Regex::new(&pattern)
                .with_context(|| format!("invalid regex pattern: {pattern}"))?;

            let mut matched = false;
            let mut names: Vec<_> = ck.config.circuits.keys().collect();
            names.sort();

            for name in names {
                if re.is_match(name) {
                    let out = ck.compile(name)?;
                    println!("compiled {name} to {}", out.display());
                    matched = true;
                }
            }

            if !matched {
                anyhow::bail!("no circuits matched pattern '{pattern}'");
            }
        }

        Commands::Instantiate { circuit } => {
            let path = ck.instantiate(&circuit)?;
            println!("instantiated at {}", path.display());
        }

        Commands::Info { circuit } => {
            let info = ck.info(&circuit)?;
            println!("Circuit: {circuit}");
            println!("  Wires:          {}", info.wires);
            println!("  Constraints:    {}", info.constraints);
            println!("  Public inputs:  {}", info.public_inputs);
            println!("  Private inputs: {}", info.private_inputs);
            println!("  Public outputs: {}", info.public_outputs);
            println!("  Labels:         {}", info.labels);
            if let Some(prime) = info.prime_name {
                println!("  Prime:          {prime}");
            }
            if info.uses_custom_gates {
                println!("  Custom gates:   yes");
            }
        }

        Commands::Clear { circuit } => {
            ck.clear(&circuit)?;
            println!("cleared {circuit}");
        }

        Commands::Setup { circuit, ptau } => {
            let out = ck.setup(&circuit, ptau.as_deref())?;
            println!("pkey: {}", out.pkey_path.display());
            println!("vkey: {}", out.vkey_path.display());
        }

        Commands::Ptau { circuit } => {
            let path = ck.ptau(&circuit)?;
            println!("ptau: {}", path.display());
        }

        Commands::Vkey { circuit } => {
            let path = ck.vkey(&circuit)?;
            println!("vkey: {}", path.display());
        }

        Commands::Contract { circuit } => {
            let path = ck.contract(&circuit)?;
            println!("contract: {}", path.display());
        }

        Commands::Witness { circuit, input } => {
            let path = ck.witness(&circuit, &input, None)?;
            println!("witness: {}", path.display());
        }

        Commands::Prove {
            circuit,
            input,
            backend,
        } => {
            let path = ck.prove(&circuit, &input, None, backend)?;
            println!("proof: {}", path.display());
        }

        Commands::Verify { circuit, input } => {
            let ok = ck.verify(&circuit, &input)?;
            if ok {
                println!("OK! Proof is valid.");
            } else {
                println!("INVALID. Proof verification failed.");
                std::process::exit(1);
            }
        }

        Commands::Calldata {
            circuit,
            input,
            pretty,
        } => {
            let calldata = ck.calldata(&circuit, &input, pretty)?;
            println!("{calldata}");
        }

        Commands::Json { target } => match target {
            JsonTarget::R1cs { circuit } => {
                let info = ck.info(&circuit)?;
                println!(
                    "{}",
                    serde_json::to_string_pretty(&serde_json::json!({
                        "wires": info.wires,
                        "constraints": info.constraints,
                        "publicInputs": info.public_inputs,
                        "privateInputs": info.private_inputs,
                        "publicOutputs": info.public_outputs,
                        "labels": info.labels,
                    }))?
                );
            }
        },
    }

    Ok(())
}
