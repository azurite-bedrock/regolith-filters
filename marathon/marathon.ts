import { load_config } from './config.ts';
import { discover_files, patch_files } from './discover.ts';
import { build_env_vars, cleanup, run_all } from './runner.ts';
import { join } from '@std/path/join';
import { resolve } from '@std/path/resolve';

const config = load_config();
const rootDir = resolve(config.root_dir);

Deno.chdir(rootDir);

const files = await discover_files(config, rootDir);
await patch_files(files);

const env = await build_env_vars(rootDir, config);

let denoConfig: string | undefined;
if (config.deno_config !== undefined) {
    denoConfig = resolve(config.deno_config);
} else {
    const searchRoots = [rootDir];
    const regolithProjectRoot = Deno.env.get('ROOT_DIR');
    if (regolithProjectRoot !== undefined) {
        searchRoots.push(regolithProjectRoot); // Always true
    }
    for (const searchRoot of searchRoots) {
        for (const name of ['deno.json', 'deno.jsonc']) {
            const p = join(searchRoot, name);
            try {
                const info = await Deno.stat(p);
                if (info.isFile) {
                    denoConfig = p;
                    break;
                }
            } catch {
                /* not found */
            }
        }
    }
}

await run_all(files, env, denoConfig);

await cleanup(files);
