import { assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert';
import { parse as parseSemVer } from '@std/semver';
import { parseConfig } from './config.ts';
import type { ScriptModule } from './config.ts';
import { buildManifest } from './manifest.ts';
import { offsetSourceMap, buildSourceMappingObject } from './debug.ts';

// config

Deno.test('parseConfig - applies all defaults', async () => {
    const config = await parseConfig({ modules: ['@minecraft/server@1.0.0'] });
    assertEquals(config.entry, ['main.ts']);
    assertEquals(config.minify, true);
    assertEquals(config.format, 'esm');
    assertEquals(config.sourcemap, undefined);
    assertEquals(config.outfile, 'BP/scripts/main.js');
    assertEquals(config.outdir, 'BP/scripts');
    assertEquals(config.debugBuild, false);
    assertEquals(config.injectSourceMapping, false);
    assertEquals(config.disableManifestModification, false);
    assertEquals(config.manifest, 'BP/manifest.json');
    assertEquals(config.rolldownConfig, 'rolldown.config.ts');
});

Deno.test('parseConfig - normalises entry string to array', async () => {
    const config = await parseConfig({
        modules: ['@minecraft/server@1.0.0'],
        entry: 'src/index.ts',
    });
    assertEquals(config.entry, ['src/index.ts']);
});

Deno.test('parseConfig - accepts entry as array', async () => {
    const config = await parseConfig({
        modules: ['@minecraft/server@1.0.0'],
        entry: ['a.ts', 'b.ts'],
    });
    assertEquals(config.entry, ['a.ts', 'b.ts']);
});

Deno.test('parseConfig - parses module name and version', async () => {
    const config = await parseConfig({
        modules: ['@minecraft/server@1.2.3', '@minecraft/server-ui@1.0.0'],
    });
    assertEquals(config.modules[0].name, '@minecraft/server');
    assertEquals(config.modules[1].name, '@minecraft/server-ui');
});

Deno.test('parseConfig - beta semver is valid', async () => {
    const config = await parseConfig({ modules: ['@minecraft/server@1.0.0-beta'] });
    assertEquals(config.modules[0].name, '@minecraft/server');
});

Deno.test('parseConfig - missing modules rejects', async () => {
    await assertRejects(() => parseConfig({}), Error, 'modules');
});

Deno.test('parseConfig - empty modules array rejects', async () => {
    await assertRejects(() => parseConfig({ modules: [] }), Error, 'modules');
});

Deno.test('parseConfig - invalid module format rejects', async () => {
    await assertRejects(
        () => parseConfig({ modules: ['minecraft/server'] }),
        Error,
        '@scope/name@<semver>',
    );
});

Deno.test('parseConfig - invalid semver in module rejects', async () => {
    await assertRejects(
        () => parseConfig({ modules: ['@minecraft/server@not-a-version'] }),
        Error,
    );
});

Deno.test('parseConfig - rolldownConfig false disables lookup', async () => {
    const config = await parseConfig({
        modules: ['@minecraft/server@1.0.0'],
        rolldownConfig: false,
    });
    assertEquals(config.rolldownConfig, false);
});

Deno.test('parseConfig - custom rolldownConfig path', async () => {
    const config = await parseConfig({
        modules: ['@minecraft/server@1.0.0'],
        rolldownConfig: 'custom.config.ts',
    });
    assertEquals(config.rolldownConfig, 'custom.config.ts');
});

Deno.test('parseConfig - invalid format rejects', async () => {
    await assertRejects(
        () => parseConfig({ modules: ['@minecraft/server@1.0.0'], format: 'invalid' }),
        Error,
        'format',
    );
});

// manifest

function mod(name: string, version: string): ScriptModule {
    return { name, version: parseSemVer(version) };
}

const baseManifest = () => ({
    format_version: 2,
    header: {
        name: 'test',
        description: 'test',
        uuid: 'hdr-uuid',
        version: [1, 0, 0],
        min_engine_version: [1, 21, 0],
    },
    modules: [{ type: 'data', uuid: 'data-uuid', version: [1, 0, 0] }],
    dependencies: [{ uuid: 'rp-uuid', version: [1, 0, 0] }],
});

Deno.test('buildManifest - adds script module', () => {
    const result = buildManifest(
        baseManifest(),
        [mod('@minecraft/server', '1.0.0')],
        'test-uuid',
        'scripts/main.js',
    );
    const scriptMod = result.modules.find((m) => m.type === 'script');
    assertEquals(scriptMod?.uuid, 'test-uuid');
    assertEquals(scriptMod?.entry, 'scripts/main.js');
    assertEquals(scriptMod?.language, 'javascript');
    assertEquals(scriptMod?.type, 'script');
});

Deno.test('buildManifest - adds dependency', () => {
    const result = buildManifest(
        baseManifest(),
        [mod('@minecraft/server', '1.2.3')],
        'uuid',
        'scripts/main.js',
    );
    const dep = result.dependencies.find((d) => d.module_name === '@minecraft/server');
    assertEquals(dep?.version, '1.2.3');
});

Deno.test('buildManifest - adds multiple dependencies', () => {
    const modules = [mod('@minecraft/server', '1.0.0'), mod('@minecraft/server-ui', '1.0.0')];
    const result = buildManifest(baseManifest(), modules, 'uuid', 'scripts/main.js');
    const serverDep = result.dependencies.find((d) => d.module_name === '@minecraft/server');
    const uiDep = result.dependencies.find((d) => d.module_name === '@minecraft/server-ui');
    assertEquals(serverDep?.version, '1.0.0');
    assertEquals(uiDep?.version, '1.0.0');
});

Deno.test('buildManifest - throws on conflicting dependency version', () => {
    const manifest = {
        ...baseManifest(),
        dependencies: [{ module_name: '@minecraft/server', version: '1.0.0' }],
    };
    assertThrows(
        () =>
            buildManifest(
                manifest,
                [mod('@minecraft/server', '2.0.0')],
                'uuid',
                'scripts/main.js',
            ),
        Error,
        '@minecraft/server',
    );
});

Deno.test('buildManifest - does not duplicate existing matching dependency', () => {
    const manifest = {
        ...baseManifest(),
        dependencies: [{ module_name: '@minecraft/server', version: '1.0.0' }],
    };
    const result = buildManifest(
        manifest,
        [mod('@minecraft/server', '1.0.0')],
        'uuid',
        'scripts/main.js',
    );
    const deps = result.dependencies.filter((d) => d.module_name === '@minecraft/server');
    assertEquals(deps.length, 1);
});

Deno.test('buildManifest - preserves existing modules', () => {
    const result = buildManifest(
        baseManifest(),
        [mod('@minecraft/server', '1.0.0')],
        'uuid',
        'scripts/main.js',
    );
    const dataMod = result.modules.find((m) => m.type === 'data');
    assertEquals(dataMod?.uuid, 'data-uuid');
});

Deno.test('buildManifest - preserves non-module fields', () => {
    const result = buildManifest(
        baseManifest(),
        [mod('@minecraft/server', '1.0.0')],
        'uuid',
        'scripts/main.js',
    );
    assertEquals(result.header?.['uuid'], 'hdr-uuid');
});

// debug

Deno.test('offsetSourceMap - prepends empty line to mappings', () => {
    const sm = { version: 3, sources: ['src/main.ts'], names: [], mappings: 'AAAA;AACA,SAAA' };
    const result = offsetSourceMap(sm);
    assertEquals(result.mappings, ';AAAA;AACA,SAAA');
});

Deno.test('offsetSourceMap - preserves all other fields', () => {
    const sm = {
        version: 3,
        sources: ['src/main.ts'],
        names: ['foo'],
        mappings: 'AAAA',
        sourceRoot: '',
    };
    const result = offsetSourceMap(sm);
    assertEquals(result.version, 3);
    assertEquals(result.sources, ['src/main.ts']);
    assertEquals(result.names, ['foo']);
});

Deno.test('buildSourceMappingObject - strips data/dinoscript/ prefix from sources', () => {
    // Segment "AAAA" = VLQ [0, 0, 0, 0] — generated col 0, source 0, orig line 0, orig col 0
    const sm = {
        version: 3,
        sources: ['../data/dinoscript/src/main.ts'],
        names: [],
        mappings: 'AAAA',
    };
    const result = buildSourceMappingObject(sm, 'BP/scripts/main.js');
    assertEquals(result[1].source, 'src/main.ts');
});

Deno.test('buildSourceMappingObject - sets metadata with filename and offset', () => {
    const sm = { version: 3, sources: ['main.ts'], names: [], mappings: 'AAAA' };
    const result = buildSourceMappingObject(sm, 'BP/scripts/main.js');
    assertEquals(result.metadata.filePath, 'main.js');
    assertEquals(result.metadata.offset, 1);
});

Deno.test('buildSourceMappingObject - records only first mapping per generated line', () => {
    // AAAA,SAAA: two segments on gen line 1, only first should be recorded
    const sm = {
        version: 3,
        sources: ['main.ts'],
        names: [],
        mappings: 'AAAA,SAAA',
    };
    const result = buildSourceMappingObject(sm, 'BP/scripts/main.js');
    assertEquals(result[1].originalLine, 1);
    const lineKeys = Object.keys(result).filter((k) => !isNaN(Number(k)));
    assertEquals(lineKeys.length, 1);
});
