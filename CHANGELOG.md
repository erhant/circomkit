# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.0.16] - 2023-18-17

- Quickfix: `compile` failed when there is no `build` folder.

## [0.0.15] - 2023-18-17

### Added

- `compile` now calls Circom subprocess instead of using WASM tester. This provides better control over cmdline args, e.g. we can call `--inspect` and `--O2` and such. [#20](https://github.com/erhant/circomkit/issues/20)
- Added `inspect` option to config, defaulting to `true`.
- Added `--O2` and `--O2round` optimization levels by allowing `optimization` to be any number. If optimization is greater than 2, it corresponds to `--O2round` with the max round number as optimization level.

## [0.0.14] - 2023-18-15

### Added

- Teardown script to terminate SnarkJS which makes tests hang indefinitely otherwise.
- `readWitness` added to `WitnessTester`.
- `readWitnessSignals` added to `WitnessTester`.
- `compute` function parameter typing fixed. It now allows any symbol.

### Changed

- Default optimization level is now 1.

### Fixed

- Fixed missing `WitnessTester` import in outputs of `npx circomkit init`.

## [0.0.13] - 2023-18-15

- Wrongfully published.

## [0.0.12] - 2023-07-01

- Released to public via Twitter post: <https://twitter.com/0xerhant/status/1675589591452065793>.
