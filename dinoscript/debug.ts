import { existsSync } from '@std/fs';
import { join, resolve } from '@std/path';
import sourceMap from 'source-map-js';
import type { Config } from './config.ts';

export interface RawSourceMap {
    version: number;
    sources: string[];
    names: string[];
    mappings: string;
    sourceRoot?: string;
    sourcesContent?: (string | null)[];
}

export function offsetSourceMap(sm: RawSourceMap): RawSourceMap {
    return { ...sm, mappings: ';' + sm.mappings };
}

export interface SourceMappingObject {
    [line: number]: { source: string; originalLine: number };
    metadata: { filePath: string; offset: number };
}

export function buildSourceMappingObject(sm: RawSourceMap, outfile: string): SourceMappingObject {
    const mapping: { [line: number]: { source: string; originalLine: number } } = {};
    const consumer = new sourceMap.SourceMapConsumer(sm as unknown as sourceMap.RawSourceMap);

    consumer.eachMapping((m) => {
        if (m.source == null || m.originalLine == null || mapping[m.generatedLine] !== undefined) return;
        let source = m.source;
        const prefix = '/data/dinoscript/';
        const i = source.indexOf(prefix);
        if (i !== -1) source = source.slice(i + prefix.length);
        mapping[m.generatedLine] = { source, originalLine: m.originalLine };
    });

    const fileName = outfile.replace(/^BP\/scripts\//, '');
    return { ...mapping, metadata: { filePath: fileName, offset: 1 } };
}

// .vscode/launch.json management

const LAUNCH_CONFIG_NAME = '(dinoscript) Debug with Minecraft';

function stripJsonComments(text: string): string {
    return text.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function ensureDebugLaunchConfig(rootDir: string, uuid: string): void {
    const vscodePath = join(rootDir, '.vscode');
    const launchPath = join(vscodePath, 'launch.json');

    let launch: { version?: string; configurations: Record<string, unknown>[] } = {
        version: '0.2.0',
        configurations: [],
    };

    if (existsSync(launchPath)) {
        try {
            launch = JSON.parse(stripJsonComments(Deno.readTextFileSync(launchPath)));
        } catch {
            console.warn(`Could not parse ${launchPath} — skipping launch.json update`);
            return;
        }
    } else {
        try {
            Deno.mkdirSync(vscodePath, { recursive: true });
        } catch {
            /* already exists */
        }
    }

    if (!Array.isArray(launch.configurations)) launch.configurations = [];

    const props: Record<string, unknown> = {
        type: 'minecraft-js',
        request: 'attach',
        name: LAUNCH_CONFIG_NAME,
        mode: 'listen',
        port: 19144,
        sourceMapRoot: '${workspaceFolder}/.regolith/tmp/BP/scripts/',
        generatedSourceRoot: '${workspaceFolder}/.regolith/tmp/BP/scripts/',
        localRoot: '${workspaceFolder}/packs/data/dinoscript/',
        targetModuleUuid: uuid,
    };

    const existing = launch.configurations.findIndex((c) => c['name'] === LAUNCH_CONFIG_NAME);
    if (existing === -1) {
        launch.configurations.push(props);
    } else {
        launch.configurations[existing] = { ...launch.configurations[existing], ...props };
    }

    Deno.writeTextFileSync(launchPath, JSON.stringify(launch, null, 4));
    console.log(`Updated ${launchPath}`);
}

// Main debug build step

export async function applyDebugBuild(
    config: Config,
    rootDir: string,
    uuid: string,
): Promise<void> {
    if (!config.debugBuild) return;

    ensureDebugLaunchConfig(rootDir, uuid);

    if (!config.injectSourceMapping) return;

    const mapPath = resolve(config.outfile + '.map');
    if (!existsSync(mapPath)) {
        console.warn(
            `Source map not found at ${mapPath} — skipping globalSourceMapping injection`,
        );
        return;
    }

    const sm: RawSourceMap = JSON.parse(Deno.readTextFileSync(mapPath));
    const mappingObj = buildSourceMappingObject(sm, config.outfile);
    const injection = `var globalSourceMapping = ${JSON.stringify(mappingObj)};\n`;

    const outPath = resolve(config.outfile);
    const original = Deno.readTextFileSync(outPath);
    Deno.writeTextFileSync(outPath, injection + original);
    console.log(`Injected globalSourceMapping into ${config.outfile}`);

    const updated = offsetSourceMap(sm);
    Deno.writeTextFileSync(mapPath, JSON.stringify(updated));
    console.log(`Adjusted source map offsets in ${config.outfile}.map`);
}
