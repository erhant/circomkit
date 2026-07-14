# Rust Library

The `Circomkit` orchestrator exposes the same operations as the CLI. Add the
umbrella crate:

```toml
[dependencies]
circomkit = { git = "https://github.com/erhant/circomkit" }
```

Load config from a file (or construct it directly), then drive the lifecycle:

```rust
use circomkit::{Circomkit, signals};

// Accepts any AsRef<Path>: &str, PathBuf, ...
let ck = Circomkit::from_file("circomkit.json")?;

// Artifacts output under build/multiplier_3
ck.compile("multiplier_3")?;

// Compute a witness from inline signals
let input = signals!{ "in" => vec![3_i64, 5, 7] };
let wtns = ck.witness("multiplier_3", "my_input", Some(&input))?;

// Generate a proof; pass None to fall back to the configured backend
let proof = ck.prove("multiplier_3", "my_input", Some(&input), None)?;

// Verify it
assert!(ck.verify("multiplier_3", "my_input")?);
```

## Operations

The struct mirrors the CLI: `instantiate`, `compile`, `info`, `clear`, `ptau`,
`setup`, `vkey`, `contract`, `witness`, `prove`, `verify`, `calldata`,
`load_input`, plus the testers `witness_tester` and `proof_tester` (see
[Testing](./testing.md)).

The design is intentionally FFI-friendly: no generics, owned return types. This
is what makes the [Node.js & Bun](./bindings.md) bindings a thin wrapper.

## Native proving backends

Enable the native backends via Cargo features on the umbrella crate:

```toml
[dependencies]
circomkit = { git = "...", features = ["prove-arkworks", "prove-lambdaworks"] }
```

Then pass a backend override to `prove` (or leave `None` to use the configured
one):

```rust
use circomkit::ProvingBackendKind;
ck.prove("my_circuit", "my_input", None, Some(ProvingBackendKind::Arkworks))?;
```

See [Backends](./backends.md) for the capability matrix.

## Runnable example

A full walkthrough lives in `crates/circomkit/examples/multiplier.rs`:

```sh
cargo run -p circomkit --example multiplier
```
