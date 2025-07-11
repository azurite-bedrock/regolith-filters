# Dinoscript

Dinoscript lets you develop Script API code using the Deno runtime and all of its tooling. It's akin to the [gametests](https://github.com/Bedrock-OSS/regolith-filters/tree/master/gametests) filter.

For bundling code, it uses the `deno bundle` command (introduced in v2.4.0), which itself uses [esbuild](https://esbuild.github.io) under the hood.

## Installation

Install it automatically via Regolith:

```bash
regolith install dinoscript
```

Then add the following to the relevant profiles:

```json
{
    "filters": [
        {
            "filter": "dinoscript",
            "settings": {
                "modules": ["@minecraft/server@2.0.0"]
            }
        }
    ]
}
```

## Configuration

| Name | Type | Default | Description |
| - | - | - | - |
| `entry` | `string` | `mod.ts` | The entry file in `data/dinoscript/` |
| `minify` | `boolean` | `true` | Whether to minify code or not |
| `modules` | `string[]` | | List of Minecraft Script modules. E.g. `@minecraft/server@2.0.0` |
