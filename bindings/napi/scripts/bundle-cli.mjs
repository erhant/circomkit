#!/usr/bin/env node
// Bundle the native `circomkit` CLI binary into a napi platform package so the
// single `circomkit` npm package ships both the library (.node addon) and the
// CLI. Run in CI after `napi create-npm-dirs` and the per-target `cargo build`.
//
//   node scripts/bundle-cli.mjs <platform-key> <path-to-built-binary>
//
// e.g. node scripts/bundle-cli.mjs darwin-arm64 target/aarch64-apple-darwin/release/circomkit
//
// Assumes napi placed the platform package at `npm/<platform-key>/`.

import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [key, binaryPath] = process.argv.slice(2);
if (!key || !binaryPath) {
  console.error("usage: bundle-cli.mjs <platform-key> <path-to-built-binary>");
  process.exit(1);
}

const isWindows = key.includes("win32");
const binName = isWindows ? "circomkit.exe" : "circomkit";

const pkgDir = join("npm", key);
const pkgJsonPath = join(pkgDir, "package.json");
if (!existsSync(pkgJsonPath)) {
  console.error(`platform package not found: ${pkgJsonPath} (run 'napi create-npm-dirs' first)`);
  process.exit(1);
}
if (!existsSync(binaryPath)) {
  console.error(`built binary not found: ${binaryPath}`);
  process.exit(1);
}

// Copy the binary into the platform package.
const dest = join(pkgDir, binName);
copyFileSync(binaryPath, dest);
if (!isWindows) chmodSync(dest, 0o755);

// Ensure it is published with the package.
const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
pkg.files = Array.from(new Set([...(pkg.files ?? []), binName]));
writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");

console.log(`bundled ${binName} into ${pkgDir}`);
