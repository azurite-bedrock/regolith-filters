# Marathon

*Marathon is a parallel script execution runtime that automatically discovers and runs generator scripts to automate the creation of content at scale.*

## Features

-   **Parallel Execution**: Run multiple generator scripts simultaneously for faster processing
-   **Flexible Deployment**: Works as a Regolith filter or standalone tool
-   **Environment Integration**: Automatic setup of environment variables for BP/RP directories
-   **Library Support**: Smart handling of library files and TypeScript definitions
-   **Working Directory Management**: Each script runs in its appropriate context

## Installation as a Regolith Filter

Add Marathon to your `config.json`:

```json
{
    "filters": [{ "filter": "marathon" }]
}
```

## Usage

### Generator Script Placement

**Option 1: Anywhere in your project**
Place your generator scripts (`script_name.ts`/`.js`) anywhere in your project structure. Marathon will discover and execute them automatically.

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

Files with specific suffixes are treated as libraries and will not be executed:

-   `.lib.ts` / `.lib.js` - Library files
-   `.test.ts` / `.test.js` - Deno Test files
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
-   Check that files aren't marked as libraries (`.lib`, `.test` or `.d` suffixes)
-   Verify the script location is not filtered out

**Environment variables not found**

-   Ensure `BP/` and `RP/` directories exist in your project root
-   Check that subdirectories exist before referencing their environment variables

**Permission errors**

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
