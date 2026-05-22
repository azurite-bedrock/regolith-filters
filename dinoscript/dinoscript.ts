import { parseConfig } from './config.ts';
import { getUUID, updateManifest } from './manifest.ts';
import { runBundle } from './bundle.ts';
import { applyDebugBuild } from './debug.ts';

function fail(msg: string): never {
    console.error(msg);
    Deno.exit(1);
}

if (import.meta.main) {
    const rootDir = Deno.env.get('ROOT_DIR');
    if (!rootDir) fail('ROOT_DIR environment variable is not set');

    const rawSettings = Deno.args[0];
    if (!rawSettings) fail('filter settings must be passed as argv[0]');

    let config;
    try {
        config = await parseConfig(JSON.parse(rawSettings));
    } catch (e) {
        fail((e as Error).message);
    }

    const uuid = getUUID(rootDir);

    updateManifest(config, uuid);
    await runBundle(config);
    await applyDebugBuild(config, rootDir, uuid);
}
