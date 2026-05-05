import { join, basename } from '@std/path';
import { walk } from '@std/fs/walk';
import { parseConfig } from './config.ts';
import { resolveTemplate } from './template.ts';
import { resolveGitInfo } from './git.ts';
import { buildZip, type ZipEntry } from './archive.ts';
import { patchManifestVersion, parseVersionFromTag } from './manifest.ts';

if (!import.meta.main) Deno.exit(1);

const ROOT_DIR = Deno.env.get('ROOT_DIR');
if (!ROOT_DIR) {
    console.error('parcel: ROOT_DIR environment variable is not set.');
    Deno.exit(1);
}

let config;
try {
    config = parseConfig(Deno.args[0] ?? '');
} catch (e) {
    console.error(`parcel: ${e instanceof Error ? e.message : e}`);
    Deno.exit(1);
}
const git = resolveGitInfo();

// Load project config.json for template context, missing file is non-fatal
let projectConfig: Record<string, unknown> = {};
try {
    projectConfig = JSON.parse(Deno.readTextFileSync(join(ROOT_DIR, 'config.json')));
} catch {
    // proceed with empty config
}

let outputRelative;
try {
    outputRelative = resolveTemplate(config.output, { config: projectConfig, git });
} catch (e) {
    console.error(`parcel: ${e instanceof Error ? e.message : e}`);
    Deno.exit(1);
}
const outputPath = join(ROOT_DIR, outputRelative);

// Resolve version for manifest patching
let version: [number, number, number] | null = null;
if (config.update_version_from_tag) {
    if (!git.tag) {
        console.warn(
            'parcel: update_version_from_tag is true but no git tag found - manifests unchanged.',
        );
    } else {
        version = parseVersionFromTag(git.tag);
        if (!version) {
            console.warn(
                `parcel: could not parse version from tag "${git.tag}" - manifests unchanged.`,
            );
        }
    }
}

function pathExists(p: string): boolean {
    try {
        Deno.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function toRelative(filePath: string, rootPath: string): string {
    return filePath
        .slice(rootPath.length)
        .replace(/^[/\\]+/, '')
        .replace(/\\/g, '/');
}

async function collectDir(
    diskRoot: string,
    zipPrefix: string,
    patchManifest: boolean,
): Promise<ZipEntry[]> {
    if (!pathExists(diskRoot)) return [];
    const result: ZipEntry[] = [];
    for await (const entry of walk(diskRoot, { includeDirs: false })) {
        const rel = toRelative(entry.path, diskRoot);
        const zipPath = zipPrefix ? `${zipPrefix}/${rel}` : rel;
        if (patchManifest && version && rel === 'manifest.json') {
            const text = Deno.readTextFileSync(entry.path);
            let patched;
            try {
                patched = patchManifestVersion(text, version);
            } catch (e) {
                throw new Error(
                    `parcel: failed to patch manifest at "${entry.path}": ${e instanceof Error ? e.message : e}`,
                );
            }
            result.push({ zipPath, content: new TextEncoder().encode(patched) });
        } else {
            result.push({ zipPath, diskPath: entry.path });
        }
    }
    return result;
}

const cwd = Deno.cwd();
const bpPath = join(cwd, config.bp);
const rpPath = join(cwd, config.rp);
const worldPath = join(cwd, config.world);
const skinPath = join(cwd, config.skin_pack);
const bpName = basename(config.bp);
const rpName = basename(config.rp);

let entries: ZipEntry[] = [];

switch (config.content_type) {
    case 'addon':
    case 'editor_addon':
        entries = [
            ...(await collectDir(bpPath, bpName, true)),
            ...(await collectDir(rpPath, rpName, true)),
        ];
        break;
    case 'resource_pack':
        entries = await collectDir(rpPath, '', true);
        break;
    case 'behavior_pack':
        entries = await collectDir(bpPath, '', true);
        break;
    case 'skin_pack':
        entries = await collectDir(skinPath, '', true);
        break;
    case 'world':
    case 'world_template':
        entries = [
            ...(await collectDir(worldPath, '', true)),
            ...(await collectDir(bpPath, `behavior_packs/${bpName}`, true)),
            ...(await collectDir(rpPath, `resource_packs/${rpName}`, true)),
        ];
        break;
}

if (entries.length === 0) {
    console.error('parcel: no files found to pack. Check your source paths and content_type.');
    Deno.exit(1);
}

await buildZip(entries, outputPath, config.compression_level, config.stored_extensions);
console.log(`Packed ${entries.length} file(s) -> ${outputPath}`);
