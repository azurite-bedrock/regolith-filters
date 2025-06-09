# Marathon

Marathon is a powerful automation tool for Minecraft Bedrock Edition projects that works as both a Regolith filter and a standalone utility. It enables you to run multiple generator scripts in parallel to automate repetitive tasks like creating blocks, items, entities, and features at scale.

## Features

-   **Parallel Execution**: Run multiple generator scripts simultaneously for faster processing
-   **Flexible Deployment**: Works as a Regolith filter or standalone tool
-   **Environment Integration**: Automatic setup of environment variables for BP/RP directories
-   **Library Support**: Smart handling of library files and TypeScript definitions
-   **Working Directory Management**: Each script runs in its appropriate context

## Installation

### As a Regolith Filter

Add Marathon to your `config.json`:

```json
{
    "filters": [
        {
            "filter": "marathon",
            "settings": {
                "root_dir": "./"
            }
        }
    ]
}
```

### Standalone Usage

```bash
deno run --allow-all marathon.ts '{"root_dir": "./your-project"}'
```

## Usage

### Generator Script Placement

**Option 1: Anywhere in your project**
Place your generator scripts (`script_name.ts` or `script_name.js`) anywhere in your project structure. Marathon will discover and execute them automatically.

**Option 2: Dedicated directory**
Create scripts in the `data/marathon/` directory for better organization. These scripts are treated identically to those placed elsewhere.

_notably, both options may be used at the same time._

### Example Generator Script

```typescript
// BP/blocks/create_colored_blocks.ts
const colors = ['red', 'blue', 'green', 'yellow'];
const blockTemplate = {
    format_version: '1.20.10',
    'minecraft:block': {
        description: {
            identifier: '',
            menu_category: {
                category: 'construction',
            },
        },
        components: {
            'minecraft:material_instances': {
                '*': {
                    texture: '',
                    render_method: 'opaque',
                },
            },
        },
    },
};

for (const color of colors) {
    const block = JSON.parse(JSON.stringify(blockTemplate));
    block['minecraft:block'].description.identifier = `mypack:${color}_block`;
    block['minecraft:block'].components['minecraft:material_instances'][
        '*'
    ].texture = `${color}_block`;

    await Deno.writeTextFile(`colored_blocks/${color}_block.json`, JSON.stringify(block));
}

console.log(`Generated ${colors.length} colored blocks`);
```

## Library Files

Files with specific suffixes are treated as libraries and won't be executed:

-   `.lib.ts` / `.lib.js` - Library files
-   `.d.ts` / `.d.js` - TypeScript definition files

Example:

```typescript
// utils.lib.ts - This won't be executed by Marathon
export function createIdentifier(namespace: string, name: string): string {
    return `${namespace}:${name}`;
}
```

## Environment Variables

Marathon automatically sets up environment variables to help your scripts locate project directories:

### Static Variables

-   `MARATHON_ROOT_DIR` - The root directory of your project
-   `MARATHON_BP_DIR` - Path to the Behavior Pack directory
-   `MARATHON_RP_DIR` - Path to the Resource Pack directory

### Dynamic Variables

Marathon creates environment variables for each subdirectory in your BP and RP folders:

-   `MARATHON_BP_BLOCKS` - Points to `BP/blocks/`
-   `MARATHON_BP_ITEMS` - Points to `BP/items/`
-   `MARATHON_RP_TEXTURES` - Points to `RP/textures/`
-   And so on...

### Accessing Environment Variables

```typescript
// Get the blocks directory
const blocksDir = Deno.env.get('MARATHON_BP_BLOCKS');

// Get the root directory
const rootDir = Deno.env.get('MARATHON_ROOT_DIR');
```

## Best Practices

### Script Organization

-   **Keep scripts focused**: Each generator should handle **one** specific task
-   **Use descriptive names**: `generate_tool_variants.ts` is better than `script1.ts`
-   **Organize by function**: Group related generators in subdirectories

### Performance Optimization

-   **Parallel-friendly design**: Avoid dependencies between scripts since execution order is not guaranteed
-   **Split tasks into small files**: Break large operations into multiple small scripts to maximize parallel execution benefits
-   **Use environment variables**: Access predefined paths instead of constructing them manually

### Error Handling

```typescript
try {
    // Your generation logic here
    await Deno.writeTextFile(filePath, content);
    console.log('✅ Successfully generated content');
} catch (error) {
    console.error('❌ Generation failed:', error.message);
    Deno.exit(1);
}
```

## Configuration

### Root Directory

By default, Marathon uses the current working directory. Override this with:

```json
{
    "root_dir": "/path/to/your/project"
}
```

### Project Structure

Marathon expects the following structure:

```
your-project/
└── packs/
    ├── BP/                 # Behavior Pack
    │   ├── blocks/
    │   ├── items/
    │   └── entities/
    ├── RP/                 # Resource Pack
    │   ├── textures/
    │   └── models/
    └── data/
        └── marathon/       # Optional: dedicated generators
```

## Troubleshooting

### Common Issues

**Scripts not executing**

-   Ensure files have `.ts` or `.js` extensions
-   Check that files aren't marked as libraries (`.lib` or `.d` suffixes)
-   Verify the script location is not filtered out

**Environment variables not found**

-   Ensure `BP/` and `RP/` directories exist in your project root
-   Check that subdirectories exist before referencing their environment variables

**Permission errors**

-   Run with `--allow-all` flag when using standalone mode, already covered if using Regolith
-   Ensure Marathon has write access to target directories

### Debug Mode

Add logging to your generators:

```typescript
console.log('Starting generation...');
console.log('Working directory:', Deno.cwd());
console.log(
    'Available env vars:',
    Object.keys(Deno.env.toObject()).filter((k) => k.startsWith('MARATHON_'))
);
```

## Contributing

When contributing generators or improvements:

1. Test with both Regolith and standalone modes
2. Ensure scripts are self-contained and don't depend on execution order
3. Include error handling and informative logging
4. Follow the established naming conventions
