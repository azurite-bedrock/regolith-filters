import { existsSync } from '@std/fs';
import { join } from '@std/path';
import { format as formatSemVer } from '@std/semver';
import type { Config, ScriptModule } from './config.ts';

interface ManifestModule {
    description?: string;
    type: string;
    language?: string;
    entry?: string;
    uuid: string;
    version: [number, number, number] | string;
}

interface ManifestDependency {
    module_name?: string;
    uuid?: string;
    version: string | [number, number, number];
}

interface Manifest {
    format_version?: number;
    header?: Record<string, unknown>;
    modules: ManifestModule[];
    dependencies: ManifestDependency[];
    [key: string]: unknown;
}

function fail(msg: string): never {
    console.error(msg);
    Deno.exit(1);
}

export function buildManifest(
    raw: unknown,
    modules: ScriptModule[],
    uuid: string,
    entry: string,
): Manifest {
    if (typeof raw !== 'object' || raw === null) {
        throw new Error('manifest must be a JSON object');
    }
    const manifest = raw as Manifest;

    if (!Array.isArray(manifest.modules)) manifest.modules = [];
    if (!Array.isArray(manifest.dependencies)) manifest.dependencies = [];

    for (const mod of modules) {
        const version = formatSemVer(mod.version);
        const conflicting = manifest.dependencies.find(
            (d) => d.module_name === mod.name && d.version !== version,
        );
        if (conflicting) {
            throw new Error(
                `module \`${mod.name}\` already exists in the manifest with version \`${conflicting.version}\`, cannot add \`${version}\``,
            );
        }
        const alreadyExists = manifest.dependencies.some(
            (d) => d.module_name === mod.name && d.version === version,
        );
        if (!alreadyExists) {
            manifest.dependencies.push({ module_name: mod.name, version });
        }
    }

    manifest.modules.push({
        description: 'Scripting',
        type: 'script',
        uuid,
        language: 'javascript',
        version: [1, 0, 0],
        entry,
    });

    return manifest;
}

export function getUUID(rootDir: string): string {
    const uuidPath = join(rootDir, 'packs', 'data', 'dinoscript', 'uuid.txt');
    if (existsSync(uuidPath)) {
        return Deno.readTextFileSync(uuidPath);
    }
    const uuid = crypto.randomUUID();
    Deno.writeTextFileSync(uuidPath, uuid);
    return uuid;
}

export function updateManifest(config: Config, uuid: string): void {
    if (config.disableManifestModification) return;

    if (!existsSync(config.manifest, { isFile: true })) {
        fail(`BP manifest not found at \`${config.manifest}\``);
    }

    const raw = JSON.parse(Deno.readTextFileSync(config.manifest));
    const entry = config.outfile.replace(/^BP\//, '');

    let updated: Manifest;
    try {
        updated = buildManifest(raw, config.modules, uuid, entry);
    } catch (e) {
        fail((e as Error).message);
    }

    console.log(`Updating ${config.manifest}`);
    Deno.writeTextFileSync(config.manifest, JSON.stringify(updated, null, 4));
}
