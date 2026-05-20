# Changelog

All notable changes to shush are documented here.

## [1.0.3] - 2026-05-15

### Changed

- Performance: inline processing threshold raised to 500 files (avoids worker startup overhead for small-to-medium projects)
- Performance: large-file-first sorting is now deferred to the worker path only, reducing overhead for the common inline case

## [1.0.2] - 2026-05-13

### Added

- JSON5 support: `.json5` files are now processed (comments and trailing commas stripped, file renamed to `.json`)
- Follow symlinks when walking directories

### Changed

- Minor code cleanup

## [1.0.1] - 2026-04-30

### Fixed

- Minification produced incorrect output in certain edge cases; `process.ts` rewritten to handle these correctly

## [1.0.0] - 2026-04-25

Initial release.

### Added

- Strip comments (`//` and `/* */`) from JSON and JSONC files
- Remove trailing commas before `}` or `]`
- Optional minification (`minify: true`) to produce compact, whitespace-free JSON
- Convert `.jsonc` files to `.json` in-place
- Async processing using a Deno worker pool for large projects
- Configurable concurrency and batch size
- Skips `data/**` files (Regolith data directory)
