import { walk } from '@std/fs';
import { dirname } from '@std/path/dirname';

interface Config {
    root_dir?: string;
}

interface Generator {
    path: string;
    name: string;
    process: Deno.ChildProcess;
}

function load_config() {
    try {
        const config = JSON.parse(Deno.args[0]) as Config;
        if (!config.root_dir) console.error('Settings object must contain a "root_dir"');
        return config;
    } catch {
        return { root_dir: './' };
    }
}

const config = load_config();
const real_path = await Deno.realPath(config.root_dir!);

Deno.chdir(config.root_dir!);

// Step 1: List .ts files
const tsFiles: string[] = [];
for await (const file of walk('./', {
    includeDirs: false,
    followSymlinks: true,
    canonicalize: true,
    exts: ['ts'],
})) {
    const path = file.path;
    if (path.startsWith('data') && !path.startsWith('data/marathon')) continue;
    tsFiles.push(path);
}

// Step 2: Run .ts files
const task_queue: Array<Generator> = [];
for (const filePath of tsFiles) {
    const file_data = await Deno.readTextFile(filePath);
    if (!file_data.startsWith('await Deno.stdin.read(new Uint8Array(1));')) {
        const data = 'await Deno.stdin.read(new Uint8Array(1));\n' + file_data;
        await Deno.writeTextFile(filePath, data);
    }
    const process = new Deno.Command(Deno.execPath(), {
        args: ['run', '--allow-all', await Deno.realPath(filePath)],
        env: { MARATHON_ROOT_DIR: real_path },
        cwd: dirname(filePath),
        stdin: 'piped',
        stderr: 'inherit',
        stdout: 'inherit',
    });
    task_queue.push({
        path: filePath,
        name: filePath.split('/').pop()!,
        process: process.spawn(),
    });
}

for (const cmd of task_queue) {
    console.info(`Invoking ${cmd.name}`);
    const writer = cmd.process.stdin.getWriter();
    await writer.write(new TextEncoder().encode('\n'));
    writer.close();
    const status = await cmd.process.status;
    if (!status.success) Deno.exit(status.code);
}

// Step 3: Delete .ts files
for (const filePath of tsFiles) {
    await Deno.remove(filePath);
}
