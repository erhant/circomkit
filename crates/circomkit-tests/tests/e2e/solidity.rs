//! Solidity verifier + calldata integration test (feature `test-solidity`).
//!
//! End-to-end proof that the calldata circomkit emits is EVM-correct:
//!
//! 1. prove `multiplier_3`, then export its snarkjs Groth16 verifier (`.sol`);
//! 2. compile the verifier to runtime bytecode with `solc`;
//! 3. deploy the bytecode into an in-process EVM ([`revm`]);
//! 4. drive `verifyProof` with the exact calldata from [`Circomkit::calldata`],
//!    ABI-encoded via [`alloy_sol_types`] — a passing verification certifies
//!    the whole formatter, including the Ethereum `pB` index reversal.
//!
//! Requires the `solc` binary on PATH. The test **skips with a notice** when it
//! is missing — install it via
//! <https://docs.soliditylang.org/en/latest/installing-solidity.html>.

use std::path::Path;
use std::process::Command;

use alloy_primitives::{Address, U256, address, hex};
use alloy_sol_types::{SolCall, sol};
use circomkit::signals;
use revm::database::{CacheDB, EmptyDB};
use revm::primitives::TxKind;
use revm::state::{AccountInfo, Bytecode};
use revm::{Context, ExecuteEvm, MainBuilder, MainContext};

use super::common::{TEST_PTAU, test_circomkit, workspace_root};

sol! {
    function verifyProof(
        uint[2] _pA,
        uint[2][2] _pB,
        uint[2] _pC,
        uint[1] _pubSignals
    ) external view returns (bool);
}

/// Arbitrary address the verifier bytecode is deployed at.
const VERIFIER: Address = address!("0x0000000000000000000000000000000000001234");
/// Arbitrary caller (balance/nonce default to 0, gas price is 0).
const CALLER: Address = address!("0x000000000000000000000000000000000000c0de");
/// Below revm's per-tx gas cap; a Groth16 verify costs well under this.
const GAS_LIMIT: u64 = 16_000_000;

#[test]
fn groth16_verifier_accepts_circomkit_calldata() {
    let (ck, _guard) = test_circomkit();
    ck.compile("multiplier_3").unwrap();
    let ptau = workspace_root().join("tests/ptau").join(TEST_PTAU);
    ck.setup("multiplier_3", Some(&ptau)).unwrap();

    let input = signals! { "in" => vec![2_i64, 4, 10] };
    ck.prove("multiplier_3", "sol_test", Some(&input), None)
        .unwrap();

    // Export the Solidity verifier and compile it to runtime bytecode.
    let sol_path = ck.contract("multiplier_3").unwrap();
    let Some(runtime) = solc_runtime_bytecode(&sol_path) else {
        eprintln!(
            "skipping groth16_verifier_accepts_circomkit_calldata: `solc` not found on PATH. \
             Install it to run the Solidity verifier tests: \
             https://docs.soliditylang.org/en/latest/installing-solidity.html"
        );
        return;
    };

    // circomkit's own calldata -> alloy-encoded `verifyProof` args.
    let calldata_str = ck.calldata("multiplier_3", "sol_test", false).unwrap();
    let w = parse_hex_words(&calldata_str);
    assert_eq!(
        w.len(),
        9,
        "expected 9 calldata words, got {}: {calldata_str}",
        w.len()
    );
    let call = verifyProofCall {
        _pA: [w[0], w[1]],
        _pB: [[w[2], w[3]], [w[4], w[5]]],
        _pC: [w[6], w[7]],
        _pubSignals: [w[8]],
    };

    // Honest calldata must verify.
    let out = eth_call(&runtime, call.abi_encode());
    assert!(
        verifyProofCall::abi_decode_returns(&out).unwrap(),
        "verifier rejected valid calldata from circomkit"
    );

    // Tampering the public signal must be rejected.
    let mut tampered = call.clone();
    tampered._pubSignals = [w[8] + U256::from(1)];
    let out = eth_call(&runtime, tampered.abi_encode());
    assert!(
        !verifyProofCall::abi_decode_returns(&out).unwrap(),
        "verifier accepted a tampered public signal"
    );
}

/// Compile `sol_path` with `solc` and return the `Groth16Verifier` runtime
/// bytecode, or `None` if `solc` is not on PATH (so the caller can skip).
/// Panics on an actual compilation failure.
fn solc_runtime_bytecode(sol_path: &Path) -> Option<Vec<u8>> {
    let output = Command::new("solc")
        .arg("--optimize")
        .args(["--combined-json", "bin-runtime"])
        .arg(sol_path)
        .output()
        .ok()?; // solc missing -> skip
    assert!(
        output.status.success(),
        "solc failed:\n{}",
        String::from_utf8_lossy(&output.stderr)
    );

    // combined-json: { "contracts": { "<path>:Groth16Verifier": { "bin-runtime": "<hex>" } } }
    let json: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    let contracts = json["contracts"].as_object().expect("solc: no contracts");
    let (_, contract) = contracts
        .iter()
        .find(|(name, _)| name.ends_with(":Groth16Verifier"))
        .expect("solc: Groth16Verifier not found");
    let bin = contract["bin-runtime"].as_str().expect("no bin-runtime");
    Some(hex::decode(bin).expect("invalid runtime hex"))
}

/// Execute a `CALL` to the verifier bytecode and return the raw return data.
fn eth_call(runtime: &[u8], calldata: Vec<u8>) -> Vec<u8> {
    let mut db = CacheDB::new(EmptyDB::default());
    db.insert_account_info(
        VERIFIER,
        AccountInfo::from_bytecode(Bytecode::new_raw(runtime.to_vec().into())),
    );

    let mut evm = Context::mainnet().with_db(db).build_mainnet();
    let tx = revm::context::TxEnv::builder()
        .caller(CALLER)
        .kind(TxKind::Call(VERIFIER))
        .data(calldata.into())
        .gas_limit(GAS_LIMIT)
        .build_fill();

    let exec = evm.transact(tx).expect("evm transact").result;
    assert!(exec.is_success(), "verifier call reverted: {exec:?}");
    exec.output().expect("no return data").to_vec()
}

/// Extract every `0x`-prefixed 32-byte (64 hex char) word from a calldata
/// string, in order. circomkit emits groth16 calldata as
/// `pA[2] / pB[2][2] / pC[2] / pubSignals[1]` -> exactly 9 words.
fn parse_hex_words(calldata: &str) -> Vec<U256> {
    let mut words = Vec::new();
    let mut i = 0;
    while let Some(rel) = calldata[i..].find("0x") {
        let start = i + rel + 2;
        let end = start + 64;
        if end <= calldata.len() && calldata[start..end].bytes().all(|b| b.is_ascii_hexdigit()) {
            words.push(U256::from_str_radix(&calldata[start..end], 16).unwrap());
            i = end;
        } else {
            i = start;
        }
    }
    words
}
