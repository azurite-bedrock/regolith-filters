# Dinoscript

Dinoscript lets you develop Script API code using the Deno runtime and all of its tooling.
It is a drop-in alternative to the [gametests](https://github.com/Bedrock-OSS/regolith-filters/tree/master/gametests) filter.

For bundling it uses [rolldown](https://rolldown.rs) — a fast Rust-based bundler compatible with the rollup plugin ecosystem. [`@deno/rolldown-plugin`](https://github.com/denoland/deno-rolldown-plugin) is included automatically, so your `deno.json` import map and `npm:` specifiers resolve as expected.

## Installation

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

Your entry file lives at `data/dinoscript/src/main.ts`.

## Configuration

| Name                        | Type                                 | Default                | Description                                                                                  |
| --------------------------- | ------------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------- |
| entry                       | `string \| string[]`                 | `"src/main.ts"`        | Entry file(s) relative to `data/dinoscript/`. Accepts paths or glob patterns.                |
| modules                     | `string[]`                           | —                      | Minecraft Script API modules. E.g. `@minecraft/server@2.0.0`                                 |
| minify                      | `boolean`                            | `true`                 | Minify the output                                                                            |
| format                      | `"esm" \| "cjs" \| "iife"`           | `"esm"`                | Output module format                                                                         |
| sourcemap                   | `"linked" \| "inline" \| "external"` | —                      | Sourcemap mode (omit to disable)                                                             |
| outfile                     | `string`                             | `"BP/scripts/main.js"` | Output file for single-entry builds; used as the manifest `entry`                            |
| outdir                      | `string`                             | `"BP/scripts"`         | Output directory for multi-entry builds                                                      |
| debugBuild                  | `boolean`                            | `false`                | Enable source maps and auto-configure `.vscode/launch.json`                                  |
| injectSourceMapping         | `boolean`                            | `false`                | Inject `globalSourceMapping` into output JS for runtime stack traces. Requires `debugBuild`. |
| disableManifestModification | `boolean`                            | `false`                | Skip all `BP/manifest.json` editing                                                          |
| manifest                    | `string`                             | `"BP/manifest.json"`   | Path to the BP manifest                                                                      |
| rolldownConfig              | `string \| false`                    | `"rolldown.config.ts"` | Path to optional rolldown config in `data/dinoscript/`. Set to `false` to disable.           |

## Custom rolldown config

Create `data/dinoscript/rolldown.config.ts` to add plugins or override build options. The function receives the resolved `InputOptions` (already populated with your entry points, externals, and the Deno plugin) and returns the modified options:

```typescript
import type { InputOptions } from 'npm:rolldown';

export default (config: InputOptions): InputOptions => {
    return {
        ...config,
        plugins: [...(config.plugins ?? []), myPlugin()],
    };
};
```
