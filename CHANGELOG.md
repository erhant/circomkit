# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased] - yyyy-mm-dd

### Added

- Teardown script to terminate SnarkJS which makes tests hang indefinitely otherwise.
- `readWitness` added to `WitnessTester`.
- `readWitnessSignals` added to `WitnessTester`.
- `compute` function parameter typing fixed. It now allows any symbol.

### Changed

- Default optimization level is now 1.

### Fixed

- Fixed missing `WitnessTester` import in outputs of `npx circomkit init`.

## [0.0.12] - 2023-07-01

- Released to public via Twitter post: <https://twitter.com/0xerhant/status/1675589591452065793>.
