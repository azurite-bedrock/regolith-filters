# Parcel

Parcel packages Minecraft content into `.mc*` archive files. It handles all standard content types, applies deflate compression with automatic STORE mode for already-compressed formats, supports template-based output paths with git and config context, and can patch manifest version numbers from a git tag.

## Installation

```bash
regolith install parcel
```

Then add it to the relevant profile:

```json
{
    "filters": [
        {
            "filter": "parcel",
            "settings": {
                "content_type": "addon",
                "output": "build/${config.name}-${git.tag ?? 'dev'}.mcaddon"
            }
        }
    ]
}
```

## Configuration

| Name                      | Type       | Default      | Description                                                     |
| ------------------------- | ---------- | ------------ | --------------------------------------------------------------- |
| `content_type`            | `string`   | **required** | Content type, see [Content Types](#content-types)               |
| `output`                  | `string`   | **required** | Output path template, see [Output Templates](#output-templates) |
| `bp`                      | `string`   | `"BP"`       | Behavior pack directory name                                    |
| `rp`                      | `string`   | `"RP"`       | Resource pack directory name                                    |
| `world`                   | `string`   | `"World"`    | World directory name                                            |
| `skin_pack`               | `string`   | `"SkinPack"` | Skin pack directory name                                        |
| `compression_level`       | `0–9`      | `6`          | Deflate compression level (0 = no compression, 9 = maximum)     |
| `stored_extensions`       | `string[]` | See below    | File extensions stored without compression                      |
| `update_version_from_tag` | `boolean`  | `false`      | Patch manifest versions from the latest git tag                 |

### Stored extensions (default)

The following extensions are stored without deflate compression by default, as their formats are already compressed:

`.png`, `.jpg`, `.jpeg`, `.ogg`, `.fsb`, `.zip`, `.mcpack`, `.mcaddon`, `.mcworld`, `.mctemplate`, `.mceditoraddon`

Setting `stored_extensions` replaces this list entirely.

## Content Types

| `content_type`   | Output format    | Source directories                                                       |
| ---------------- | ---------------- | ------------------------------------------------------------------------ |
| `addon`          | `.mcaddon`       | `BP/`, `RP/` (each at their own root inside the archive)                 |
| `editor_addon`   | `.mceditoraddon` | `BP/`, `RP/` (each at their own root inside the archive)                 |
| `resource_pack`  | `.mcpack`        | `RP/` (files at archive root)                                            |
| `behavior_pack`  | `.mcpack`        | `BP/` (files at archive root)                                            |
| `skin_pack`      | `.mcpack`        | `SkinPack/` (files at archive root)                                      |
| `world`          | `.mcworld`       | `World/` + `BP/` under `behavior_packs/` + `RP/` under `resource_packs/` |
| `world_template` | `.mctemplate`    | `World/` + `BP/` under `behavior_packs/` + `RP/` under `resource_packs/` |

The file extension in `output` is not enforced, use the correct extension for the content type.

## Output Templates

The `output` value is a JavaScript template literal. Two variables are available:

- `config`: the project's `config.json` parsed as an object
- `git`: git state at build time

```typescript
interface GitInfo {
    tag: string | null; // latest tag (git describe --tags --abbrev=0)
    commit: string | null; // HEAD commit SHA
    branch: string | null; // current branch name
    tagCommit: string | null; // commit SHA the tag points to
}
```

### Examples

```
"output": "build/MyAddon.mcaddon"
"output": "build/${config.name}.mcaddon"
"output": "build/${config.name}-${git.tag ?? 'dev'}.mcaddon"
"output": "dist/${git.branch}/${config.name}.mcworld"
```

`config.json` is loaded from `ROOT_DIR` (the regolith project root). If the file is missing, `config` is an empty object.

> **Note:** `output` is evaluated as trusted filter settings. Do not use untrusted input as the template value.

## Manifest Version Patching

When `update_version_from_tag` is `true`, parcel reads the latest git tag, parses it as a version, and writes that version into any `manifest.json` files it encounters. Both `header.version` and UUID-based dependency versions are updated.

The tag is parsed as a sequence of up to three dot-separated integers. A `v` prefix and non-numeric text are ignored. Tags with more than three numeric segments are rejected (a warning is printed and manifests are left unchanged).

```
v1.2.3      -> [1, 2, 3]
release-2.0 -> [2, 0, 0]
v1.2.3.4    -> rejected (warning)
no-numbers  -> rejected (warning)
```

## Full example

```json
{
    "filter": "parcel",
    "settings": {
        "content_type": "addon",
        "output": "build/${config.project_name}-${git.tag ?? 'dev'}.mcaddon",
        "bp": "BP",
        "rp": "RP",
        "compression_level": 6,
        "update_version_from_tag": true
    }
}
```
