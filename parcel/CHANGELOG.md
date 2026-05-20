# Changelog

All notable changes to parcel are documented here.

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
