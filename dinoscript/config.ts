import { parse as parseSemVer, type SemVer } from '@std/semver';

const VALID_FORMATS = ['esm', 'cjs', 'iife'] as const;
const VALID_SOURCEMAPS = ['linked', 'inline', 'external'] as const;

export type OutputFormat = (typeof VALID_FORMATS)[number];
export type SourcemapMode = (typeof VALID_SOURCEMAPS)[number];

export interface ScriptModule {
    name: string;
    version: SemVer;
}

export interface Config {
    entry: string[];
    modules: ScriptModule[];
    minify: boolean;
    format: OutputFormat;
    sourcemap: SourcemapMode | undefined;
    outfile: string;
    outdir: string;
    debugBuild: boolean;
    injectSourceMapping: boolean;
    disableManifestModification: boolean;
    manifest: string;
    rolldownConfig: string | false;
}

function fail(msg: string): never {
    throw new Error(msg);
}

function parseModule(raw: unknown): ScriptModule {
    if (typeof raw !== 'string') {
        fail(`each module must be a string, got ${JSON.stringify(raw)}`);
    }
    const match = raw.match(/^(@[^@]+)@(.+)$/);
    if (!match) {
        fail(`module \`${raw}\` must follow the format \`@scope/name@<semver>\``);
    }
    const [, name, versionStr] = match;
    try {
        return { name, version: parseSemVer(versionStr) };
    } catch {
        fail(
            `module version \`${versionStr}\` in \`${raw}\` does not follow semantic versioning`,
        );
    }
}

export async function parseConfig(raw: unknown): Promise<Config> {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        fail('filter settings must be a JSON object');
    }
    const s = raw as Record<string, unknown>;

    if (!Array.isArray(s.modules) || s.modules.length === 0) {
        fail('`modules` is required and must be a non-empty array');
    }
    const modules = s.modules.map(parseModule);

    const rawEntry = s.entry ?? 'main.ts';
    const entry: string[] = Array.isArray(rawEntry)
        ? (rawEntry as unknown[]).map((e, i) => {
              if (typeof e !== 'string') fail(`entry[${i}] must be a string`);
              return e as string;
          })
        : [rawEntry as string];

    const format = s.format ?? 'esm';
    if (!VALID_FORMATS.includes(format as OutputFormat)) {
        fail(`format must be one of: ${VALID_FORMATS.join(', ')}, got \`${format}\``);
    }

    let sourcemap: SourcemapMode | undefined;
    if (s.sourcemap !== undefined) {
        if (!VALID_SOURCEMAPS.includes(s.sourcemap as SourcemapMode)) {
            fail(
                `sourcemap must be one of: ${VALID_SOURCEMAPS.join(', ')}, got \`${s.sourcemap}\``,
            );
        }
        sourcemap = s.sourcemap as SourcemapMode;
    }

    let rolldownConfig: string | false = 'rolldown.config.ts';
    if (s.rolldownConfig === false) {
        rolldownConfig = false;
    } else if (typeof s.rolldownConfig === 'string') {
        rolldownConfig = s.rolldownConfig;
    } else if (s.rolldownConfig !== undefined) {
        fail('`rolldownConfig` must be a string or false');
    }

    return {
        entry,
        modules,
        minify: typeof s.minify === 'boolean' ? s.minify : true,
        format: format as OutputFormat,
        sourcemap,
        outfile: typeof s.outfile === 'string' ? s.outfile : 'BP/scripts/main.js',
        outdir: typeof s.outdir === 'string' ? s.outdir : 'BP/scripts',
        debugBuild: typeof s.debugBuild === 'boolean' ? s.debugBuild : false,
        injectSourceMapping:
            typeof s.injectSourceMapping === 'boolean' ? s.injectSourceMapping : false,
        disableManifestModification:
            typeof s.disableManifestModification === 'boolean'
                ? s.disableManifestModification
                : false,
        manifest: typeof s.manifest === 'string' ? s.manifest : 'BP/manifest.json',
        rolldownConfig,
    };
}
