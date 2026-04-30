# regolith-filters

Collection of [Regolith](https://github.com/Bedrock-OSS/regolith) filters developed and maintained by Azurite.

## Filters

- **`marathon`**: Parallel script execution runtime. Automatically discovers and runs generator scripts (TypeScript/JavaScript) to automate content creation at scale. Scripts run concurrently with access to BP/RP environment variables.

- **`dinoscript`**: Script API transpiler and bundler. Write Minecraft Script API code using the Deno runtime and its full toolchain; outputs a single bundled JS file via esbuild.

- **`shush`**: JSON/JSONC post-processor. Strips comments, removes trailing commas, and optionally minifies or reformats JSON files. Processes packs asynchronously using a worker pool; tiny packs are handled inline with no worker overhead.

- **`parcel`**: Pack archiver. Packages BP, RP, world, skin pack, and editor addon content into the correct `.mc*` archive format. Supports configurable deflate compression with automatic STORE mode for already-compressed formats, eval-based output path templates with git and config context, and optional manifest version patching from git tags.
