# Changelog

All notable changes to rune are documented here.

## [Unreleased]

### Added

- `exclusion.json` in `RP/texts/` and/or `BP/texts/`: an array of keys to omit from coverage totals (for keys that are intentionally not translated, e.g. brand names)

### Changed

- Coverage report summary and per-file sections are now sorted by translation percentage (highest first)
- Locale-conflict error message now uses the platform path separator consistently instead of mixing `\` and `/`

## [1.0.0] - 2026-05-26

Initial release.

### Added

- Merge structured per-locale source folders (`RP/texts/en_US/`) into single flat Bedrock `.lang` files (`RP/texts/en_US.lang`) for both RP and BP
- Flat passthrough mode: locales stored as a single `.lang` file are passed through unchanged
- Source formats: `.lang` (key=value), `.json` (flat object), `.json5` (flat object with comment support)
- Hard error on duplicate keys across source files — prints both file paths and the key
- Structure enforcement: non-reference locales must mirror the reference locale's folder structure (configurable, default on)
- Translation coverage reporting: tracks translated, untranslated, missing, and stale keys per locale and per source file
- Coverage report written to `ROOT_DIR/reports/rune_coverage_report.md` in markdown
- `stripComments` option: strip all comments and blank lines from merged output
- `randomizeEntries` option: globally shuffle all entries in merged output
- `errorOnMissingTranslations` option: fail build if any locale has missing keys (report written first)
- Console output: per-file log lines, coverage summary, results summary with timing
