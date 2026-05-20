# Changelog

All notable changes to parcel are documented here.

## [1.1.0] - 2026-05-20

### Added

- `content_type: "custom"` with a `pathmap` config option: maps arbitrary source paths to ZIP destinations, enabling non-standard archive layouts (e.g. world templates with world data alongside BP/RP). Use a `ROOT:` prefix on any source key to resolve it from `ROOT_DIR` (the Regolith project root) instead of the Regolith working directory.

### Fixed

- ZIP archives now include explicit directory entries emitted before their contents, matching the ordering expected by strict extractors (Marketplace backend, Java's `ZipInputStream`, etc.). Previously no directory entries were written, causing ingestion failures with tools that require parent directories to precede child files.
- File entries within the archive are now written in deterministic alphabetical order, ensuring consistent output across platforms and filesystems.
- Git commands (`git describe`, `git rev-parse`, etc.) are now run in `ROOT_DIR` (the Regolith project root) instead of the Regolith temp working directory. Previously all git info (`tag`, `commit`, `branch`) resolved to `null` in practice because the temp directory is not a git repository.
- If archive creation fails mid-write the partial output file is now deleted before exiting, preventing a corrupt archive from being left on disk.

## [1.0.2] - 2026-05-13

### Added

- Follow symlinks when traversing pack directories during archiving

## [1.0.1] - 2026-05-08

### Fixed

- Removed `eval` usage in template processing; output templates are now evaluated safely

## [1.0.0] - 2026-04-30

Initial release.

### Added

- Package Bedrock add-on files into `.mcaddon`, `.mcpack`, `.mcworld`, or `.mctemplate` archives
- Configurable content type (`addon`, `behavior_pack`, `resource_pack`, `world`, `world_template`)
- JavaScript template literal support for the `output` path (access `config` and `git` variables)
- Automatic manifest version patching from the latest git tag (`update_version_from_tag`)
- Configurable compression level (0–9) and per-extension storage without compression
- Configurable BP, RP, World, and SkinPack directory names
