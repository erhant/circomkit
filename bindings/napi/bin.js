#!/usr/bin/env node
"use strict";

// Launcher for the native `circomkit` CLI binary. Contains no CLI logic: it
// locates the platform's prebuilt Rust binary (bundled inside the matching
// `circomkit-<platform>` package, next to the .node addon) and execs it,
// forwarding argv and the exit code.

const { execFileSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { join } = require("node:path");

/// Map process.platform + process.arch to the napi platform-package key.
/// Must match the `targets` in package.json.
function platformKey() {
  const { platform, arch } = process;
  if (platform === "darwin") {
    if (arch === "arm64") return "darwin-arm64";
    if (arch === "x64") return "darwin-x64";
  } else if (platform === "linux") {
    if (arch === "x64") return "linux-x64-gnu";
    if (arch === "arm64") return "linux-arm64-gnu";
  } else if (platform === "win32") {
    if (arch === "x64") return "win32-x64-msvc";
  }
  return null;
}

function binaryName() {
  return process.platform === "win32" ? "circomkit.exe" : "circomkit";
}

/// Locate the native binary: prefer the installed platform package, then a
/// binary bundled next to this launcher (local dev / single-file installs).
function resolveBinary() {
  const bin = binaryName();
  const key = platformKey();

  if (key) {
    try {
      const pkgJson = require.resolve(`circomkit-${key}/package.json`);
      const candidate = join(pkgJson, "..", bin);
      if (existsSync(candidate)) return candidate;
    } catch {
      // platform package not installed — fall through
    }
  }

  const local = join(__dirname, bin);
  if (existsSync(local)) return local;

  return null;
}

const binary = resolveBinary();
if (!binary) {
  console.error(
    `circomkit: no native CLI binary for ${process.platform}-${process.arch}. ` +
      `This platform may be unsupported, or the optional platform package failed to install.`
  );
  process.exit(1);
}

try {
  execFileSync(binary, process.argv.slice(2), { stdio: "inherit" });
} catch (err) {
  process.exit(typeof err.status === "number" ? err.status : 1);
}
