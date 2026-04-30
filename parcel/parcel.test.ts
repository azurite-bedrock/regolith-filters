import { assertEquals, assertThrows } from '@std/assert';
import { parseConfig, DEFAULT_STORED_EXTENSIONS } from './config.ts';

// --- parseConfig ---

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

// --- resolveTemplate ---

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

// --- patchManifestVersion ---

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

// --- parseVersionFromTag ---

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

import { shouldStore } from './archive.ts';

// --- shouldStore ---
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
