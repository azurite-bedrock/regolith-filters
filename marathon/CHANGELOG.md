# Changelog

All notable changes to marathon are documented here.

## [1.3.0] - 2026-05-20

### Added

- `deno_config` config option: explicit path to a `deno.json` or `deno.jsonc` passed as `--config` to every spawned script, useful for non-standard project layouts where the config is not at `root_dir`

### Fixed

- Marathon now works correctly when Regolith's `tmp_dir` setting points to a directory on a different drive. `Deno.realPath()` was replaced with `resolve()` from `@std/path`, which does not require the path to be on the same drive as the working directory
- Marathon now automatically discovers `deno.json` / `deno.jsonc` at `root_dir` and passes it via `--config` to every spawned script, ensuring consistent import resolution regardless of where `tmp_dir` is located

## [1.2.0] - 2026-05-10

### Added

- `extra_vars` config option: pass arbitrary environment variables to filter scripts alongside the built-in `MARATHON_BP_*` / `MARATHON_RP_*` vars

## [1.1.1] - 2026-05-05

### Fixed

- BP and RP directories were incorrectly included in file discovery and are now properly excluded
- Additional file types (e.g. `.bench.ts`) are now correctly excluded from being run as filter entry points

## [1.1.0] - 2026-04-30

### Added

- Parallel execution: filter scripts now run concurrently instead of sequentially, significantly reducing total run time
- `include` glob patterns to explicitly select which scripts to run (default: `data/marathon/**/*.ts` and `data/marathon/**/*.js`)
- `exclude` glob patterns to skip matching files (default: `data/**/*.ts` and `data/**/*.js`)

### Changed

- Codebase split into focused modules: `config.ts`, `discover.ts`, and `runner.ts`

## [1.0.1] - 2025-07-21

### Fixed

- Deno test files (`.test.ts`) are no longer run as filter entry points

## [1.0.0] - 2025-06-15

Initial release.

### Added

- Run Deno TypeScript and JavaScript scripts as Regolith filters
- Automatic environment variables injected into each script: `MARATHON_BP_<FOLDER>` and `MARATHON_RP_<FOLDER>` pointing to pack sub-directories
- Lib file support: files ending in `.lib.ts` are excluded from direct execution and can be imported by other scripts
- `root_dir` config option to specify the Regolith source directory
