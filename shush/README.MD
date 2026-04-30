# Shush

A [Regolith](https://bedrock-oss.github.io/regolith/) filter that cleans up JSON and JSONC files by stripping comments, removing trailing commas, and optionally minifying output. Processing runs asynchronously using a Deno worker pool.

## What it does

- Removes comments from JSON/JSONC files
- Removes trailing commas
- Optionally minifies output (compact, no whitespace)
- Converts `.jsonc` files to `.json` in-place
- Skips `data/**` files (Regolith data directory)

## Installation

```json
{
    "filter": "shush"
}
```

## Configuration

Pass settings as a JSON object in your `config` field:

```json
{
    "filter": "shush",
    "settings": {
        "minify": true
    }
}
```

| Option                 | Type    | Default | Description                                        |
| ---------------------- | ------- | ------- | -------------------------------------------------- |
| `removeComments`       | boolean | `true`  | Strip `//` and `/* */` comments                    |
| `removeTrailingCommas` | boolean | `true`  | Remove trailing commas before `}` or `]`           |
| `minify`               | boolean | `false` | Output compact JSON with no whitespace             |
| `jsonc`                | boolean | `true`  | Also process `.jsonc` files (converted to `.json`) |
| `tabSize`              | number  | `4`     | Spaces per indent level (ignored when minifying)   |
| `batchSize`            | number  | `20`    | Files per worker batch                             |

## Notes

- All processing is text-level — number representations like `0.0` and `1e2` are preserved as-is in both normal and minify modes.
- Concurrency scales automatically with `navigator.hardwareConcurrency` (capped at 32).
- Small file sets (below `concurrency * 2`) are processed inline without spawning workers.
