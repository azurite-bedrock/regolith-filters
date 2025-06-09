import { walk } from '@std/fs';
import { dirname } from '@std/path/dirname';
import { join } from '@std/path/join';
import { SEPARATOR } from '@std/path/constants';

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
const root_directory = await Deno.realPath(config.root_dir!);

Deno.chdir(root_directory);

const tsFiles: { path: string; lib?: true }[] = [];
for await (const file of walk('./', {
    includeDirs: false,
    followSymlinks: true,
    canonicalize: true,
    exts: ['ts', 'js'],
})) {
    const path = file.path;
    const lib =
        path.endsWith('.lib.ts') ||
        path.endsWith('.lib.js') ||
        path.endsWith('.d.ts') ||
        path.endsWith('.d.js')
            ? true
            : undefined;

    if (!path.startsWith(`data${SEPARATOR}marathon`) && path.startsWith(`data${SEPARATOR}`))
        continue;

    tsFiles.push({ path, lib });
}

const bpRoot = join(root_directory, 'BP');
const rpRoot = join(root_directory, 'RP');

const baseEnvyVars: Record<string, string> = {
    MARATHON_BP_DIR: bpRoot,
    MARATHON_RP_DIR: rpRoot,
    MARATHON_ROOT_DIR: root_directory,
};

for await (const folder of Deno.readDir(bpRoot)) {
    if (!folder.isDirectory) continue;

    baseEnvyVars[`MARATHON_BP_${folder.name.toUpperCase()}`] = join(bpRoot, folder.name);
}

for await (const folder of Deno.readDir(rpRoot)) {
    if (!folder.isDirectory) continue;

    baseEnvyVars[`MARATHON_RP_${folder.name.toUpperCase()}`] = join(rpRoot, folder.name);
}

const task_queue: Array<Generator> = [];
for (const file of tsFiles) {
    if (file.lib === true) continue; // Skip library files
    const file_data = await Deno.readTextFile(file.path);

    if (!file_data.startsWith('await Deno.stdin.read(new Uint8Array(1));')) {
        const data = 'await Deno.stdin.read(new Uint8Array(1));\n' + file_data;
        await Deno.writeTextFile(file.path, data);
    }

    const process = new Deno.Command(Deno.execPath(), {
        args: ['run', '--allow-all', await Deno.realPath(file.path)],
        env: baseEnvyVars,
        cwd: dirname(file.path),
        stdin: 'piped',
        stderr: 'inherit',
        stdout: 'inherit',
    });

    task_queue.push({
        path: file.path,
        name: file.path.split('/').pop()!,
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

for (const file of tsFiles) {
    await Deno.remove(file.path);
}
