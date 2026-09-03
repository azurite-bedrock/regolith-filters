# Rune

_Rune merges structured, folder-organized `.lang` source files into single flat Bedrock `.lang` output files, and reports translation coverage across locales._

Instead of maintaining one large monolithic `en_US.lang`, split translations into logical subfolders per locale. Rune assembles them at build time and tracks what's been translated.

## Installation

Add Rune to your `config.json`:

```json
{
    "filters": [{ "filter": "rune" }]
}
```

## Source Structure

Organize lang files under `RP/texts/` and/or `BP/texts/` with a folder per locale:

```
RP/texts/
├── en_US/
│   ├── _root.lang
│   ├── animals/
│   │   ├── mood.lang
│   │   └── texts.lang
│   └── quests/
│       └── main.lang
└── nl_NL/
    ├── _root.lang
    └── animals/
        ├── mood.lang
        └── texts.lang
```

Rune merges all files within a locale folder into `RP/texts/en_US.lang`, `RP/texts/nl_NL.lang`, etc.

You can also keep a locale as a flat file (`RP/texts/en_US.lang`) — Rune will pass it through unchanged. Having both a folder and a flat file for the same locale is an error.

Supported source formats: `.lang`, `.json` (flat `{"key": "value"}` object), `.json5` (same as `.json`; comments in `.json5` source files are authoring convenience only and are not preserved in merged output).

## Configuration

```json
{
    "filters": [
        {
            "filter": "rune",
            "settings": {
                "referenceLocale": "en_US"
            }
        }
    ]
}
```

| Setting | Default | Description |
|---|---|---|
| `referenceLocale` | _(required)_ | Source-of-truth locale for coverage and structure enforcement |
| `enforceStructure` | `true` | Require non-reference locales to mirror the reference folder structure |
| `stripComments` | `false` | Strip all comments and blank lines from merged output |
| `randomizeEntries` | `false` | Globally shuffle entries in merged output (entries only, no comments) |
| `errorOnMissingTranslations` | `false` | Fail the build if any locale has missing keys |
| `coverage` | `true` | Write a translation coverage report to `ROOT_DIR/reports/rune_coverage_report.md` |

## Coverage Report

When `coverage` is enabled, Rune writes `ROOT_DIR/reports/rune_coverage_report.md` with a summary of translation progress across all non-reference locales, broken down per source file. Locales are ordered by translation percentage (highest first).

> **Note:** Add `reports/` to your `.gitignore` — coverage reports are generated artifacts, not source files.

### Exclusions

Some keys are intentionally not translatable — brand names, item IDs used as display strings, etc. Add an `exclusion.json` next to your locale folders listing keys that should be ignored by coverage:

```
RP/texts/
├── exclusion.json
├── en_US/
└── nl_NL/
```

```json
["item.mypack.brand_name", "entity.mypack.proper_noun"]
```

Excluded keys are subtracted from the reference total and skipped when counting translated/untranslated/missing. Both `RP/texts/exclusion.json` and `BP/texts/exclusion.json` are read and unioned; either may be absent.

## Duplicate Keys

If the same key appears in two different source files for the same locale, Rune fails the build immediately and prints both file paths. There is no last-writer-wins fallback.
