# Changelog

## [0.0.18] - TBD

- Removed linting & styling from tests, GTS broke something regarding prettier perhaps? Lints pass locally but not at the workflow.
- Changed `init` logic to be a git clone instead.

## [0.0.17] - 2023-08-30

- Merged `build` and `test` workflows.
- Added optional Circuit Config parameter to `compile` method, allowing one to compile without having the circuit config at `circuits.json`.
- Added tests for the opitonal argument.
- Added optional input data arguments to `prove` and `witness`, allowing one to provide data without having it at `inputs` folder.
- Tidy up the changelog.
- Updated `gts` for development

## [0.0.16] - 2023-07-17

- Quickfix: `compile` failed when there is no `build` folder.

## [0.0.15] - 2023-07-17

- `compile` now calls Circom subprocess instead of using WASM tester. This provides better control over cmdline args, e.g. we can call `--inspect` and `--O2` and such. [#20](https://github.com/erhant/circomkit/issues/20)
- Added `inspect` option to config, defaulting to `true`.
- Added `--O2` and `--O2round` optimization levels by allowing `optimization` to be any number. If optimization is greater than 2, it corresponds to `--O2round` with the max round number as optimization level.

## [0.0.14] - 2023-07-15

- Teardown script to terminate SnarkJS which makes tests hang indefinitely otherwise.
- `readWitness` added to `WitnessTester`.
- `readWitnessSignals` added to `WitnessTester`.
- `compute` function parameter typing fixed, it now allows any symbol.
- Default optimization level is now changed to 1 from 0.
- Fixed missing `WitnessTester` import in outputs of `npx circomkit init`.

## [0.0.13] - 2023-07-15

- Wrongfully published.

## [0.0.12] - 2023-07-01

- Released to public via Twitter post: <https://twitter.com/0xerhant/status/1675589591452065793>.
