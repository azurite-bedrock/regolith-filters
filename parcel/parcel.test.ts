import { assertEquals, assertThrows } from '@std/assert';
import { parseConfig, DEFAULT_STORED_EXTENSIONS } from './config.ts';

// parseConfig

Deno.test('parseConfig: throws on empty input', () => {
    assertThrows(() => parseConfig(''), Error, 'settings');
});

Deno.test('parseConfig: throws on missing content_type', () => {
    assertThrows(
        () => parseConfig(JSON.stringify({ output: 'out.mcaddon' })),
        Error,
        '"content_type"',
    );
});

Deno.test('parseConfig: throws on invalid content_type value', () => {
    assertThrows(
        () => parseConfig(JSON.stringify({ content_type: 'invalid', output: 'out.mcaddon' })),
        Error,
        '"content_type"',
    );
});

Deno.test('parseConfig: throws on missing output', () => {
    assertThrows(
        () => parseConfig(JSON.stringify({ content_type: 'addon' })),
        Error,
        '"output"',
    );
});

Deno.test('parseConfig: throws on compression_level below 0', () => {
    assertThrows(
        () =>
            parseConfig(
                JSON.stringify({
                    content_type: 'addon',
                    output: 'out.mcaddon',
                    compression_level: -1,
                }),
            ),
        Error,
        '"compression_level"',
    );
});

Deno.test('parseConfig: throws on compression_level above 9', () => {
    assertThrows(
        () =>
            parseConfig(
                JSON.stringify({
                    content_type: 'addon',
                    output: 'out.mcaddon',
                    compression_level: 10,
                }),
            ),
        Error,
        '"compression_level"',
    );
});

Deno.test('parseConfig: applies defaults', () => {
    const c = parseConfig(JSON.stringify({ content_type: 'addon', output: 'out.mcaddon' }));
    assertEquals(c.compression_level, 6);
    assertEquals(c.update_version_from_tag, false);
    assertEquals(c.bp, 'BP');
    assertEquals(c.rp, 'RP');
    assertEquals(c.world, 'World');
    assertEquals(c.skin_pack, 'SkinPack');
    assertEquals(c.stored_extensions, DEFAULT_STORED_EXTENSIONS);
});

Deno.test('parseConfig: accepts all content types', () => {
    const types = [
        'addon',
        'world',
        'world_template',
        'resource_pack',
        'behavior_pack',
        'skin_pack',
        'editor_addon',
    ];
    for (const ct of types) {
        const c = parseConfig(JSON.stringify({ content_type: ct, output: 'out.mcaddon' }));
        assertEquals(c.content_type, ct);
    }
});

Deno.test('parseConfig: custom content_type requires pathmap', () => {
    assertThrows(
        () => parseConfig(JSON.stringify({ content_type: 'custom', output: 'out.mcaddon' })),
        Error,
        '"pathmap"',
    );
});

Deno.test('parseConfig: custom content_type rejects empty pathmap', () => {
    assertThrows(
        () =>
            parseConfig(
                JSON.stringify({ content_type: 'custom', output: 'out.mcaddon', pathmap: {} }),
            ),
        Error,
        '"pathmap"',
    );
});

Deno.test('parseConfig: custom content_type rejects non-string pathmap values', () => {
    assertThrows(
        () =>
            parseConfig(
                JSON.stringify({
                    content_type: 'custom',
                    output: 'out.mcaddon',
                    pathmap: { BP: 42 },
                }),
            ),
        Error,
        '"pathmap"',
    );
});

Deno.test('parseConfig: custom content_type accepts valid pathmap', () => {
    const c = parseConfig(
        JSON.stringify({
            content_type: 'custom',
            output: 'out.mcaddon',
            pathmap: { BP: 'behavior_packs/0', RP: 'resource_packs/0' },
        }),
    );
    assertEquals(c.content_type, 'custom');
    assertEquals(c.pathmap, { BP: 'behavior_packs/0', RP: 'resource_packs/0' });
});

Deno.test('parseConfig: custom content_type accepts ROOT: prefix keys', () => {
    const c = parseConfig(
        JSON.stringify({
            content_type: 'custom',
            output: 'out.mctemplate',
            pathmap: { 'ROOT:worlds/release': '.' },
        }),
    );
    assertEquals(c.pathmap, { 'ROOT:worlds/release': '.' });
});

Deno.test('parseConfig: overrides stored_extensions when provided', () => {
    const exts = ['.wav', '.mp3'];
    const c = parseConfig(
        JSON.stringify({
            content_type: 'addon',
            output: 'out.mcaddon',
            stored_extensions: exts,
        }),
    );
    assertEquals(c.stored_extensions, exts);
});

Deno.test('parseConfig: accepts compression_level 0', () => {
    const c = parseConfig(
        JSON.stringify({ content_type: 'addon', output: 'out.mcaddon', compression_level: 0 }),
    );
    assertEquals(c.compression_level, 0);
});

Deno.test('parseConfig: accepts compression_level 9', () => {
    const c = parseConfig(
        JSON.stringify({ content_type: 'addon', output: 'out.mcaddon', compression_level: 9 }),
    );
    assertEquals(c.compression_level, 9);
});

import { resolveTemplate } from './template.ts';

// resolveTemplate

Deno.test('resolveTemplate: resolves config.name', () => {
    const ctx = {
        config: { name: 'MyPack' },
        git: { tag: null, commit: null, branch: null, tagCommit: null },
    };
    assertEquals(resolveTemplate('${config.name}.mcaddon', ctx), 'MyPack.mcaddon');
});

Deno.test('resolveTemplate: resolves git.tag', () => {
    const ctx = {
        config: { name: 'MyPack' },
        git: { tag: '1.2.3', commit: null, branch: null, tagCommit: null },
    };
    assertEquals(resolveTemplate('${git.tag}', ctx), '1.2.3');
});

Deno.test('resolveTemplate: resolves plain string unchanged', () => {
    const ctx = {
        config: {},
        git: { tag: null, commit: null, branch: null, tagCommit: null },
    };
    assertEquals(resolveTemplate('build/out.mcaddon', ctx), 'build/out.mcaddon');
});

Deno.test('resolveTemplate: throws descriptive error on invalid syntax', () => {
    const ctx = {
        config: {},
        git: { tag: null, commit: null, branch: null, tagCommit: null },
    };
    assertThrows(() => resolveTemplate('${invalid(}', ctx), Error, '"output"');
});

import { patchManifestVersion, parseVersionFromTag } from './manifest.ts';

// patchManifestVersion

Deno.test('patchManifestVersion: updates header.version', () => {
    const input = JSON.stringify({ header: { version: [0, 0, 1] } });
    const result = JSON.parse(patchManifestVersion(input, [1, 2, 3]));
    assertEquals(result.header.version, [1, 2, 3]);
});

Deno.test('patchManifestVersion: updates UUID dependency versions', () => {
    const input = JSON.stringify({
        header: { version: [0, 0, 1] },
        dependencies: [{ uuid: 'aaaabbbb-0000-1111-2222-ccccddddeeee', version: [0, 0, 1] }],
    });
    const result = JSON.parse(patchManifestVersion(input, [1, 2, 3]));
    assertEquals(result.dependencies[0].version, [1, 2, 3]);
});

Deno.test('patchManifestVersion: leaves non-UUID dependencies untouched', () => {
    const input = JSON.stringify({
        header: { version: [0, 0, 1] },
        dependencies: [{ module_name: '@minecraft/server', version: '1.0.0' }],
    });
    const result = JSON.parse(patchManifestVersion(input, [1, 2, 3]));
    assertEquals(result.dependencies[0].version, '1.0.0');
});

Deno.test('patchManifestVersion: handles missing dependencies array', () => {
    const input = JSON.stringify({ header: { version: [0, 0, 1] } });
    const result = JSON.parse(patchManifestVersion(input, [1, 2, 3]));
    assertEquals(result.header.version, [1, 2, 3]);
    assertEquals(result.dependencies, undefined);
});

Deno.test('patchManifestVersion: handles empty dependencies array', () => {
    const input = JSON.stringify({ header: { version: [0, 0, 1] }, dependencies: [] });
    const result = JSON.parse(patchManifestVersion(input, [2, 0, 0]));
    assertEquals(result.header.version, [2, 0, 0]);
    assertEquals(result.dependencies, []);
});

// parseVersionFromTag

Deno.test('parseVersionFromTag: parses v1.2.3', () => {
    assertEquals(parseVersionFromTag('v1.2.3'), [1, 2, 3]);
});

Deno.test('parseVersionFromTag: parses 1.2.3 without prefix', () => {
    assertEquals(parseVersionFromTag('1.2.3'), [1, 2, 3]);
});

Deno.test('parseVersionFromTag: parses release-2.0.1', () => {
    assertEquals(parseVersionFromTag('release-2.0.1'), [2, 0, 1]);
});

Deno.test('parseVersionFromTag: pads short version 1.2 to [1, 2, 0]', () => {
    assertEquals(parseVersionFromTag('1.2'), [1, 2, 0]);
});

Deno.test('parseVersionFromTag: pads single number 3 to [3, 0, 0]', () => {
    assertEquals(parseVersionFromTag('3'), [3, 0, 0]);
});

Deno.test('parseVersionFromTag: returns null for tag with no numbers', () => {
    assertEquals(parseVersionFromTag('release'), null);
});

Deno.test('parseVersionFromTag: returns null for empty string', () => {
    assertEquals(parseVersionFromTag(''), null);
});

Deno.test('parseVersionFromTag: returns null for 4-segment version', () => {
    assertEquals(parseVersionFromTag('v1.2.3.4'), null);
});

import { shouldStore, collectDirPaths, buildZip, type ZipEntry } from './archive.ts';
import { unzipSync } from 'fflate';

// shouldStore
// Uses DEFAULT_STORED_EXTENSIONS imported from config.ts (already imported above)

Deno.test('shouldStore: returns true for .png', () => {
    assertEquals(shouldStore('.png', DEFAULT_STORED_EXTENSIONS), true);
});

Deno.test('shouldStore: returns true for .jpg', () => {
    assertEquals(shouldStore('.jpg', DEFAULT_STORED_EXTENSIONS), true);
});

Deno.test('shouldStore: returns true for .ogg', () => {
    assertEquals(shouldStore('.ogg', DEFAULT_STORED_EXTENSIONS), true);
});

Deno.test('shouldStore: returns false for .json', () => {
    assertEquals(shouldStore('.json', DEFAULT_STORED_EXTENSIONS), false);
});

Deno.test('shouldStore: returns false for .ts', () => {
    assertEquals(shouldStore('.ts', DEFAULT_STORED_EXTENSIONS), false);
});

Deno.test('shouldStore: is case-insensitive (.PNG -> true)', () => {
    assertEquals(shouldStore('.PNG', DEFAULT_STORED_EXTENSIONS), true);
});

Deno.test('shouldStore: is case-insensitive (.JPG -> true)', () => {
    assertEquals(shouldStore('.JPG', DEFAULT_STORED_EXTENSIONS), true);
});

Deno.test('shouldStore: custom list overrides defaults', () => {
    assertEquals(shouldStore('.json', ['.json']), true);
    assertEquals(shouldStore('.png', ['.json']), false);
});

// collectDirPaths

Deno.test('collectDirPaths: returns [] for root-level files only', () => {
    const entries: ZipEntry[] = [
        { zipPath: 'manifest.json', content: new Uint8Array() },
        { zipPath: 'pack_icon.png', content: new Uint8Array() },
    ];
    assertEquals(collectDirPaths(entries), []);
});

Deno.test('collectDirPaths: returns single dir for one level of nesting', () => {
    const entries: ZipEntry[] = [{ zipPath: 'textures/grass.png', content: new Uint8Array() }];
    assertEquals(collectDirPaths(entries), ['textures/']);
});

Deno.test('collectDirPaths: deduplicates dirs from sibling files', () => {
    const entries: ZipEntry[] = [
        { zipPath: 'textures/a.png', content: new Uint8Array() },
        { zipPath: 'textures/b.png', content: new Uint8Array() },
        { zipPath: 'textures/c.png', content: new Uint8Array() },
    ];
    assertEquals(collectDirPaths(entries), ['textures/']);
});

Deno.test('collectDirPaths: returns all ancestor dirs for deeply nested file', () => {
    const entries: ZipEntry[] = [
        { zipPath: 'BP/textures/blocks/stone.png', content: new Uint8Array() },
    ];
    assertEquals(collectDirPaths(entries), ['BP/', 'BP/textures/', 'BP/textures/blocks/']);
});

Deno.test('collectDirPaths: sorts dirs alphabetically across multiple prefixes', () => {
    const entries: ZipEntry[] = [
        { zipPath: 'RP/textures/items/sword.png', content: new Uint8Array() },
        { zipPath: 'BP/scripts/main.js', content: new Uint8Array() },
    ];
    assertEquals(collectDirPaths(entries), [
        'BP/',
        'BP/scripts/',
        'RP/',
        'RP/textures/',
        'RP/textures/items/',
    ]);
});

// buildZip (integration)

function readU16LE(buf: Uint8Array, offset: number): number {
    return buf[offset] | (buf[offset + 1] << 8);
}

function readU32LE(buf: Uint8Array, offset: number): number {
    return (
        (buf[offset] |
            (buf[offset + 1] << 8) |
            (buf[offset + 2] << 16) |
            (buf[offset + 3] << 24)) >>>
        0
    );
}

// Reads the central directory of a ZIP and returns entry names in archive order.
function zipEntryOrder(data: Uint8Array): string[] {
    let eocdOffset = -1;
    for (let i = data.length - 22; i >= 0; i--) {
        if (readU32LE(data, i) === 0x06054b50) {
            eocdOffset = i;
            break;
        }
    }
    if (eocdOffset < 0) throw new Error('EOCD record not found');
    const cdOffset = readU32LE(data, eocdOffset + 16);
    const cdSize = readU32LE(data, eocdOffset + 12);
    const names: string[] = [];
    let pos = cdOffset;
    while (pos < cdOffset + cdSize) {
        if (readU32LE(data, pos) !== 0x02014b50) break;
        const nameLen = readU16LE(data, pos + 28);
        const extraLen = readU16LE(data, pos + 30);
        const commentLen = readU16LE(data, pos + 32);
        names.push(new TextDecoder().decode(data.slice(pos + 46, pos + 46 + nameLen)));
        pos += 46 + nameLen + extraLen + commentLen;
    }
    return names;
}

Deno.test('buildZip: directory entries precede all file entries', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        const out = `${tmp}/out.zip`;
        const entries: ZipEntry[] = [
            { zipPath: 'BP/manifest.json', content: new TextEncoder().encode('{}') },
            { zipPath: 'BP/scripts/main.js', content: new TextEncoder().encode('// entry') },
            { zipPath: 'BP/textures/grass.png', content: new Uint8Array([0x89, 0x50]) },
        ];
        await buildZip(entries, out, 6, []);
        const order = zipEntryOrder(await Deno.readFile(out));
        const lastDirIdx = order.findLastIndex((n) => n.endsWith('/'));
        const firstFileIdx = order.findIndex((n) => !n.endsWith('/'));
        assertEquals(lastDirIdx < firstFileIdx, true);
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});

Deno.test('buildZip: file entries are emitted in alphabetical order', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        const out = `${tmp}/out.zip`;
        // Supply entries intentionally out of alphabetical order
        const entries: ZipEntry[] = [
            { zipPath: 'BP/z.json', content: new TextEncoder().encode('{}') },
            { zipPath: 'BP/a.json', content: new TextEncoder().encode('{}') },
            { zipPath: 'manifest.json', content: new TextEncoder().encode('{}') },
        ];
        await buildZip(entries, out, 6, []);
        const order = zipEntryOrder(await Deno.readFile(out));
        const files = order.filter((n) => !n.endsWith('/'));
        assertEquals(files, ['BP/a.json', 'BP/z.json', 'manifest.json']);
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});

Deno.test('buildZip: no directory entries emitted for root-level files', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        const out = `${tmp}/out.zip`;
        const entries: ZipEntry[] = [
            { zipPath: 'manifest.json', content: new TextEncoder().encode('{}') },
            { zipPath: 'pack_icon.png', content: new Uint8Array([0]) },
        ];
        await buildZip(entries, out, 6, []);
        const order = zipEntryOrder(await Deno.readFile(out));
        assertEquals(
            order.filter((n) => n.endsWith('/')),
            [],
        );
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});

Deno.test('buildZip: content entries are preserved correctly', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        const out = `${tmp}/out.zip`;
        const text = '{"format_version":2}';
        const entries: ZipEntry[] = [
            { zipPath: 'manifest.json', content: new TextEncoder().encode(text) },
        ];
        await buildZip(entries, out, 6, []);
        const files = unzipSync(await Deno.readFile(out));
        assertEquals(new TextDecoder().decode(files['manifest.json']), text);
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});

Deno.test('buildZip: disk-path entries are read and packed correctly', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        const src = `${tmp}/input.json`;
        const text = '{"hello":"world"}';
        await Deno.writeTextFile(src, text);
        const out = `${tmp}/out.zip`;
        const entries: ZipEntry[] = [{ zipPath: 'data.json', diskPath: src }];
        await buildZip(entries, out, 6, []);
        const files = unzipSync(await Deno.readFile(out));
        assertEquals(new TextDecoder().decode(files['data.json']), text);
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});

// --- collectDir (custom pathmap helpers, tested via the path-resolution logic) ---

// Helper: build a small on-disk directory tree and return its path.
async function makePackDir(root: string, files: Record<string, string>): Promise<void> {
    for (const [rel, content] of Object.entries(files)) {
        const full = `${root}/${rel}`;
        await Deno.mkdir(full.slice(0, full.lastIndexOf('/')), { recursive: true });
        await Deno.writeTextFile(full, content);
    }
}

Deno.test('buildZip: custom pathmap maps directory to prefix', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        await makePackDir(tmp, {
            'BP/manifest.json': '{"format":1}',
            'BP/scripts/main.js': '// main',
        });
        const out = `${tmp}/out.zip`;
        const entries: ZipEntry[] = [];
        for await (const entry of (await import('@std/fs/walk')).walk(`${tmp}/BP`, {
            includeDirs: false,
            followSymlinks: true,
        })) {
            const rel = entry.path
                .slice(`${tmp}/BP`.length)
                .replace(/^[/\\]+/, '')
                .replace(/\\/g, '/');
            entries.push({ zipPath: `behavior_packs/0/${rel}`, diskPath: entry.path });
        }
        await buildZip(entries, out, 6, []);
        const files = unzipSync(await Deno.readFile(out));
        assertEquals(
            new TextDecoder().decode(files['behavior_packs/0/manifest.json']),
            '{"format":1}',
        );
        assertEquals(
            new TextDecoder().decode(files['behavior_packs/0/scripts/main.js']),
            '// main',
        );
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});

Deno.test('buildZip: custom pathmap dest "." places files at archive root', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        await makePackDir(tmp, {
            'World/levelname.txt': 'My World',
            'World/level.dat': 'data',
        });
        const out = `${tmp}/out.zip`;
        const entries: ZipEntry[] = [];
        for await (const entry of (await import('@std/fs/walk')).walk(`${tmp}/World`, {
            includeDirs: false,
            followSymlinks: true,
        })) {
            const rel = entry.path
                .slice(`${tmp}/World`.length)
                .replace(/^[/\\]+/, '')
                .replace(/\\/g, '/');
            entries.push({ zipPath: rel, diskPath: entry.path });
        }
        await buildZip(entries, out, 6, []);
        const files = unzipSync(await Deno.readFile(out));
        assertEquals(new TextDecoder().decode(files['levelname.txt']), 'My World');
        assertEquals(new TextDecoder().decode(files['level.dat']), 'data');
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});
