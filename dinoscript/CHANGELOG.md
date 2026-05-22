# Changelog

All notable changes to dinoscript are documented here.

## [1.0.0] - 2026-05-22

### Added

- Rolldown bundler replacing `deno bundle`, full rollup plugin ecosystem now available
- `@deno/rolldown-plugin` included by default, giving rolldown full awareness of `deno.json` import maps and `npm:` specifiers
- `rolldownConfig` option: optional `rolldown.config.ts` in `data/dinoscript/` for user-defined plugins and build overrides (`(config: InputOptions) => InputOptions`)
- `debugBuild` option: enables source maps and auto-configures `.vscode/launch.json` for Minecraft JS debugging
- `injectSourceMapping` option: prepends a `globalSourceMapping` variable to the output JS for runtime stack trace resolution (requires `debugBuild`)
- `outfile` option: control the output file path for single-entry builds (also sets the manifest `entry` field)
- `outdir` option: control the output directory for multi-entry builds
- `disableManifestModification` option: skip all manifest editing
- `manifest` option: specify a non-default path to `BP/manifest.json`
- `entry` now accepts an array of paths/globs in addition to a single string

### Changed

- `data/mod.ts` moved to `data/src/main.ts`; default `entry` updated from `"mod.ts"` to `"src/main.ts"`
- `mod.ts` (filter entrypoint) renamed to `dinoscript.ts`; filter split into focused modules: `config.ts`, `manifest.ts`, `bundle.ts`, `debug.ts`

### Removed

- Dependency on `deno bundle` subprocess

## [0.1.2] - 2026-04-30

### Added

- Deno version checking: the filter now validates the minimum required Deno version before running

### Changed

- Code formatting and cleanup

## [0.1.1] - 2025-07-28

### Fixed

- Entry loading: rewrote entry discovery logic in `mod.ts` to correctly resolve and load filter entry points

## [0.1.0] - 2025-07-22

Initial release.

### Added

- Bundle and compile TypeScript/JavaScript files using Deno's bundler
- `format` option to control output format
- `sourcemap` option to include or exclude source maps
- Configuration via Regolith filter settings
