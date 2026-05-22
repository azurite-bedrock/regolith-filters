import { expandGlob } from '@std/fs';
import { join, resolve } from '@std/path';
import { rolldown, type InputOptions, type OutputOptions } from 'rolldown';
import denoPlugin from '@deno/rolldown-plugin';
import type { Config } from './config.ts';

const FILTER_DATA_DIR = 'data/dinoscript';

type RolldownSourcemap = boolean | 'inline' | 'hidden';

function toRolldownSourcemap(mode: Config['sourcemap'] | true): RolldownSourcemap {
    if (mode === true || mode === 'linked') return true;
    if (mode === 'inline') return 'inline';
    if (mode === 'external') return 'hidden';
    return false;
}

async function resolveEntries(entry: string[]): Promise<string[]> {
    const dataDir = join(Deno.cwd(), FILTER_DATA_DIR);
    const resolved: string[] = [];
    for (const e of entry) {
        if (/[*?{}\[\]]/.test(e)) {
            for await (const file of expandGlob(e, { root: dataDir })) {
                resolved.push(file.path);
            }
        } else {
            resolved.push(join(dataDir, e));
        }
    }
    if (resolved.length === 0) {
        console.error('no entry files matched');
        Deno.exit(1);
    }
    return resolved;
}

async function loadRolldownConfig(
    config: Config,
): Promise<(opts: InputOptions) => InputOptions | Promise<InputOptions>> {
    if (config.rolldownConfig === false) return (o) => o;

    const configPath = resolve(join(Deno.cwd(), FILTER_DATA_DIR, config.rolldownConfig));
    try {
        await Deno.stat(configPath);
    } catch {
        return (o) => o;
    }

    console.log(`Loading ${config.rolldownConfig}`);
    const mod = await import(configPath);
    if (typeof mod.default !== 'function') {
        console.error(
            `\`${config.rolldownConfig}\` must export a default function (config: InputOptions) => InputOptions`,
        );
        Deno.exit(1);
    }
    return mod.default;
}

export async function runBundle(config: Config): Promise<void> {
    const entries = await resolveEntries(config.entry);
    const external = config.modules.map((m) => m.name);
    const configTransform = await loadRolldownConfig(config);

    const sourcemap: RolldownSourcemap =
        config.debugBuild && !config.sourcemap ? true : toRolldownSourcemap(config.sourcemap);

    const dataDirDenoJson = join(Deno.cwd(), FILTER_DATA_DIR, 'deno.json');
    const denoPluginOptions: { configPath?: string } = {};
    try {
        await Deno.stat(dataDirDenoJson);
        denoPluginOptions.configPath = dataDirDenoJson;
    } catch {
        /* no deno.json in data dir, let plugin do its own discovery */
    }

    let inputOptions: InputOptions = {
        input: entries.length === 1 ? entries[0] : entries,
        external,
        plugins: [denoPlugin(denoPluginOptions)],
    };
    inputOptions = await configTransform(inputOptions);

    const outputOptions: OutputOptions = {
        format: config.format,
        sourcemap,
        minify: config.minify,
    };

    if (entries.length === 1) {
        outputOptions.file = resolve(config.outfile);
    } else {
        outputOptions.dir = resolve(config.outdir);
    }

    console.log('Bundling with rolldown...');
    const build = await rolldown(inputOptions);
    await build.write(outputOptions);
    await build.close();
    console.log('Bundle complete.');
}
