import { load_config } from './config.ts';
import { discover_files, patch_files } from './discover.ts';
import { build_env_vars, cleanup, run_all } from './runner.ts';

const config = load_config();
const rootDir = await Deno.realPath(config.root_dir);

Deno.chdir(rootDir);

const files = await discover_files(config, rootDir);
await patch_files(files);

const env = await build_env_vars(rootDir, config);
await run_all(files, env);

await cleanup(files);
