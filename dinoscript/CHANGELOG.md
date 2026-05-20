# Changelog

All notable changes to dinoscript are documented here.

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
