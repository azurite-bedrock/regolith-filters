import { expandGlob } from '@std/fs';
import { join, resolve, toFileUrl } from '@std/path';
import { rolldown, type InputOptions, type OutputOptions } from 'rolldown';
import denoPlugin from '@deno/rolldown-plugin';
import type { Config } from './config.ts';

const FILTER_DATA_DIR = 'data/dinoscript';

type RolldownSourcemap = boolean | 'inline' | 'hidden';

type RolldownConfigFn = (
    input: InputOptions,
    output: OutputOptions,
) => { input: InputOptions; output: OutputOptions } | Promise<{ input: InputOptions; output: OutputOptions }>;

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

async function loadRolldownConfig(config: Config): Promise<RolldownConfigFn> {
    const identity: RolldownConfigFn = (input, output) => ({ input, output });
    if (config.rolldownConfig === false) return identity;

    const configPath = resolve(join(Deno.cwd(), FILTER_DATA_DIR, config.rolldownConfig));
    try {
        await Deno.stat(configPath);
    } catch {
        return identity;
    }

    console.log(`Loading ${config.rolldownConfig}`);
    const mod = await import(toFileUrl(configPath).href);
    if (typeof mod.default !== 'function') {
        console.error(
            `\`${config.rolldownConfig}\` must export a default function (input: InputOptions, output: OutputOptions) => { input: InputOptions; output: OutputOptions }`,
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
        platform: 'neutral',
        plugins: [denoPlugin(denoPluginOptions)],
    };

    let outputOptions: OutputOptions = {
        format: config.format,
        sourcemap,
        minify: config.minify,
        ...(entries.length === 1 ? { file: resolve(config.outfile) } : { dir: resolve(config.outdir) }),
    };

    ({ input: inputOptions, output: outputOptions } = await configTransform(inputOptions, outputOptions));

    console.log('Bundling with rolldown...');
    const build = await rolldown(inputOptions);
    await build.write(outputOptions);
    await build.close();
    console.log('Bundle complete.');
}
