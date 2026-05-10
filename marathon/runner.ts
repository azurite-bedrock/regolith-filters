import { basename } from '@std/path/basename';
import { dirname } from '@std/path/dirname';
import { join } from '@std/path/join';
import type { DiscoveredFile } from './discover.ts';
import { Config } from './config.ts';

export async function build_env_vars(
    rootDir: string,
    config: Config,
): Promise<Record<string, string>> {
    const bpRoot = join(rootDir, 'BP');
    const rpRoot = join(rootDir, 'RP');

    const env: Record<string, string> = {
        MARATHON_BP_DIR: bpRoot,
        MARATHON_RP_DIR: rpRoot,
        MARATHON_ROOT_DIR: rootDir,
    };

    for await (const folder of Deno.readDir(bpRoot)) {
        if (!folder.isDirectory) continue;
        env[`MARATHON_BP_${folder.name.toUpperCase()}`] = join(bpRoot, folder.name);
    }

    for await (const folder of Deno.readDir(rpRoot)) {
        if (!folder.isDirectory) continue;
        env[`MARATHON_RP_${folder.name.toUpperCase()}`] = join(rpRoot, folder.name);
    }

    for (const [key, val] of Object.entries(config.extra_vars)) {
        env[key] = val;
    }

    return env;
}

export async function run_all(
    files: DiscoveredFile[],
    env: Record<string, string>,
): Promise<void> {
    const encoder = new TextEncoder();

    const processes = files
        .filter((f) => !f.skip)
        .map((file) => ({
            name: basename(file.path),
            process: new Deno.Command(Deno.execPath(), {
                args: ['run', '--allow-all', file.path],
                env,
                cwd: dirname(file.path),
                stdin: 'piped',
                stderr: 'inherit',
                stdout: 'inherit',
            }).spawn(),
        }));

    const statuses = await Promise.all(
        processes.map(async ({ name, process }) => {
            console.info(`Invoking ${name}`);
            const writer = process.stdin.getWriter();
            await writer.write(encoder.encode('\n'));
            writer.close();
            return process.status;
        }),
    );

    for (const status of statuses) {
        if (!status.success) Deno.exit(status.code);
    }
}

export async function cleanup(files: DiscoveredFile[]): Promise<void> {
    await Promise.all(files.map((f) => Deno.remove(f.path)));
}
