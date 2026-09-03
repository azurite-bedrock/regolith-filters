import { assert, assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert';
import { parseConfig } from './config.ts';

Deno.test('parseConfig: throws when referenceLocale is missing', () => {
    assertThrows(() => parseConfig({}), Error, '`referenceLocale`');
});

Deno.test('parseConfig: throws when referenceLocale is empty string', () => {
    assertThrows(() => parseConfig({ referenceLocale: '' }), Error, '`referenceLocale`');
});

Deno.test('parseConfig: returns defaults for all optional fields', () => {
    const c = parseConfig({ referenceLocale: 'en_US' });
    assertEquals(c.referenceLocale, 'en_US');
    assertEquals(c.enforceStructure, true);
    assertEquals(c.stripComments, false);
    assertEquals(c.randomizeEntries, false);
    assertEquals(c.errorOnMissingTranslations, false);
    assertEquals(c.coverage, true);
});

Deno.test('parseConfig: accepts explicit values for all fields', () => {
    const c = parseConfig({
        referenceLocale: 'zh_CN',
        enforceStructure: false,
        stripComments: true,
        randomizeEntries: true,
        errorOnMissingTranslations: true,
        coverage: false,
    });
    assertEquals(c.referenceLocale, 'zh_CN');
    assertEquals(c.enforceStructure, false);
    assertEquals(c.stripComments, true);
    assertEquals(c.randomizeEntries, true);
    assertEquals(c.errorOnMissingTranslations, true);
    assertEquals(c.coverage, false);
});

Deno.test('parseConfig: throws on non-object input', () => {
    assertThrows(() => parseConfig('string'), Error, 'JSON object');
    assertThrows(() => parseConfig(null), Error, 'JSON object');
    assertThrows(() => parseConfig([]), Error, 'JSON object');
});

import { parseLang } from './parse.ts';
import type { ParsedFile } from './parse.ts';

Deno.test('parseLang: parses entries, comments, and blank lines', () => {
    const result = parseLang('## Section\nkey.one=hello\n\nkey.two=world\n', 'test.lang');
    assertEquals(result.path, 'test.lang');
    assertEquals(result.lines, [
        { type: 'comment', text: '## Section' },
        { type: 'entry', key: 'key.one', value: 'hello' },
        { type: 'blank' },
        { type: 'entry', key: 'key.two', value: 'world' },
        { type: 'blank' },
    ]);
});

Deno.test('parseLang: value is everything after the first =', () => {
    const result = parseLang('a=b=c=d\n', 'test.lang');
    assertEquals(result.lines[0], { type: 'entry', key: 'a', value: 'b=c=d' });
});

Deno.test('parseLang: ### is treated as a comment', () => {
    const result = parseLang('### Sub-section\n', 'test.lang');
    assertEquals(result.lines[0], { type: 'comment', text: '### Sub-section' });
});

Deno.test('parseLang: handles CRLF line endings', () => {
    const result = parseLang('key.a=val\r\n## comment\r\n', 'test.lang');
    assertEquals(result.lines[0], { type: 'entry', key: 'key.a', value: 'val' });
    assertEquals(result.lines[1], { type: 'comment', text: '## comment' });
});

Deno.test('parseLang: throws on duplicate key within same file', () => {
    assertThrows(
        () => parseLang('key.a=one\nkey.a=two\n', 'test.lang'),
        Error,
        'key.a',
    );
});

Deno.test('parseLang: lines without = and not starting with ## become blank', () => {
    const result = parseLang('not_a_kv_line\nkey=val\n', 'test.lang');
    assertEquals(result.lines[0], { type: 'blank' });
    assertEquals(result.lines[1], { type: 'entry', key: 'key', value: 'val' });
});

import { parseJson, parseJson5, parseFile } from './parse.ts';

Deno.test('parseJson: flat object produces entry lines', () => {
    const result = parseJson('{"key.a": "hello", "key.b": "world"}', 'test.json');
    assertEquals(result.lines, [
        { type: 'entry', key: 'key.a', value: 'hello' },
        { type: 'entry', key: 'key.b', value: 'world' },
    ]);
});

Deno.test('parseJson: throws on non-string value', () => {
    assertThrows(
        () => parseJson('{"key": 42}', 'test.json'),
        Error,
        'must be a string',
    );
});

Deno.test('parseJson: throws on nested object', () => {
    assertThrows(
        () => parseJson('{"key": {"nested": "val"}}', 'test.json'),
        Error,
        'must be a string',
    );
});

Deno.test('parseJson: throws on non-object input', () => {
    assertThrows(() => parseJson('[]', 'test.json'), Error, 'flat JSON object');
    assertThrows(() => parseJson('"string"', 'test.json'), Error, 'flat JSON object');
});

Deno.test('parseJson5: parses flat object with comments in source', () => {
    const src = `{
  // greeting
  "key.hi": "hello",
  "key.bye": "goodbye"
}`;
    const result = parseJson5(src, 'test.json5');
    assertEquals(result.lines, [
        { type: 'entry', key: 'key.hi', value: 'hello' },
        { type: 'entry', key: 'key.bye', value: 'goodbye' },
    ]);
});

Deno.test('parseFile: dispatches by extension', async () => {
    const tmpLang = await Deno.makeTempFile({ suffix: '.lang' });
    const tmpJson = await Deno.makeTempFile({ suffix: '.json' });
    try {
        await Deno.writeTextFile(tmpLang, 'k=v\n');
        await Deno.writeTextFile(tmpJson, '{"k": "v"}');
        const lang = await parseFile(tmpLang, 'test.lang');
        const json = await parseFile(tmpJson, 'test.json');
        assertEquals(lang.lines[0], { type: 'entry', key: 'k', value: 'v' });
        assertEquals(json.lines[0], { type: 'entry', key: 'k', value: 'v' });
    } finally {
        await Deno.remove(tmpLang);
        await Deno.remove(tmpJson);
    }
});

Deno.test('parseFile: dispatches .json5 extension', async () => {
    const tmpJson5 = await Deno.makeTempFile({ suffix: '.json5' });
    try {
        await Deno.writeTextFile(tmpJson5, '{"k": "v"}');
        const json5 = await parseFile(tmpJson5, 'test.json5');
        assertEquals(json5.lines[0], { type: 'entry', key: 'k', value: 'v' });
    } finally {
        await Deno.remove(tmpJson5);
    }
});

Deno.test('parseFile: throws on unsupported extension', async () => {
    const tmp = await Deno.makeTempFile({ suffix: '.txt' });
    try {
        await assertRejects(() => parseFile(tmp, 'test.txt'), Error, 'Unsupported');
    } finally {
        await Deno.remove(tmp);
    }
});

Deno.test('parseJson5: throws on non-string value', () => {
    assertThrows(
        () => parseJson5('{"key": 42}', 'test.json5'),
        Error,
        'must be a string',
    );
});

import { collectEntries, validateStructure, emitMerged } from './merge.ts';

function makeFile(path: string, entries: [string, string][]): ParsedFile {
    return {
        path,
        lines: entries.map(([key, value]) => ({ type: 'entry' as const, key, value })),
    };
}

Deno.test('collectEntries: builds key map from multiple files', () => {
    const files = [
        makeFile('_root.lang', [['pack.name', 'My Pack'], ['pack.desc', 'A pack']]),
        makeFile('animals/mood.lang', [['mood.happy', 'Happy!']]),
    ];
    const map = collectEntries(files);
    assertEquals(map.size, 3);
    assertEquals(map.get('pack.name')?.value, 'My Pack');
    assertEquals(map.get('pack.name')?.sourceFile, '_root.lang');
    assertEquals(map.get('mood.happy')?.sourceFile, 'animals/mood.lang');
});

Deno.test('collectEntries: throws on duplicate key across files', () => {
    const files = [
        makeFile('a.lang', [['dup.key', 'one']]),
        makeFile('b.lang', [['dup.key', 'two']]),
    ];
    assertThrows(() => collectEntries(files), Error, 'dup.key');
});

Deno.test('validateStructure: passes when paths match', () => {
    const refFiles = [makeFile('_root.lang', []), makeFile('animals/mood.lang', [])];
    const targetFiles = [makeFile('_root.lang', []), makeFile('animals/mood.lang', [])];
    validateStructure(refFiles, targetFiles, 'nl_NL');
});

Deno.test('validateStructure: throws on missing file in target', () => {
    const refFiles = [makeFile('_root.lang', []), makeFile('animals/mood.lang', [])];
    const targetFiles = [makeFile('_root.lang', [])];
    assertThrows(() => validateStructure(refFiles, targetFiles, 'nl_NL'), Error, 'animals/mood.lang');
});

Deno.test('validateStructure: throws on extra file in target', () => {
    const refFiles = [makeFile('_root.lang', [])];
    const targetFiles = [makeFile('_root.lang', []), makeFile('extra.lang', [])];
    assertThrows(() => validateStructure(refFiles, targetFiles, 'nl_NL'), Error, 'extra.lang');
});

import { discoverLocales } from './discover.ts';

Deno.test('discoverLocales: finds folder-mode locale in RP', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        await Deno.mkdir(`${tmp}/RP/texts/en_US`, { recursive: true });
        await Deno.writeTextFile(`${tmp}/RP/texts/en_US/_root.lang`, 'k=v\n');
        const orig = Deno.cwd();
        Deno.chdir(tmp);
        try {
            const entries = await discoverLocales();
            assertEquals(entries.length, 1);
            assertEquals(entries[0].locale, 'en_US');
            assertEquals(entries[0].pack, 'RP');
            assertEquals(entries[0].mode, 'folder');
            assertEquals(entries[0].sourceFiles.length, 1);
            assertEquals(entries[0].sourceFiles[0].relPath, '_root.lang');
        } finally {
            Deno.chdir(orig);
        }
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});

Deno.test('discoverLocales: finds flat-mode locale', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        await Deno.mkdir(`${tmp}/RP/texts`, { recursive: true });
        await Deno.writeTextFile(`${tmp}/RP/texts/en_US.lang`, 'k=v\n');
        const orig = Deno.cwd();
        Deno.chdir(tmp);
        try {
            const entries = await discoverLocales();
            assertEquals(entries.length, 1);
            assertEquals(entries[0].mode, 'flat');
            assertEquals(entries[0].locale, 'en_US');
        } finally {
            Deno.chdir(orig);
        }
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});

Deno.test('discoverLocales: finds locales in both RP and BP', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        await Deno.mkdir(`${tmp}/RP/texts/en_US`, { recursive: true });
        await Deno.writeTextFile(`${tmp}/RP/texts/en_US/_root.lang`, 'k=v\n');
        await Deno.mkdir(`${tmp}/BP/texts/en_US`, { recursive: true });
        await Deno.writeTextFile(`${tmp}/BP/texts/en_US/_root.lang`, 'k=v\n');
        const orig = Deno.cwd();
        Deno.chdir(tmp);
        try {
            const entries = await discoverLocales();
            assertEquals(entries.length, 2);
            const packs = entries.map((e) => e.pack).sort();
            assertEquals(packs, ['BP', 'RP']);
        } finally {
            Deno.chdir(orig);
        }
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});

Deno.test('discoverLocales: skips non-locale directories', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        await Deno.mkdir(`${tmp}/RP/texts/en_US`, { recursive: true });
        await Deno.writeTextFile(`${tmp}/RP/texts/en_US/_root.lang`, 'k=v\n');
        await Deno.mkdir(`${tmp}/RP/texts/_common`, { recursive: true });
        const orig = Deno.cwd();
        Deno.chdir(tmp);
        try {
            const entries = await discoverLocales();
            assertEquals(entries.length, 1);
            assertEquals(entries[0].locale, 'en_US');
        } finally {
            Deno.chdir(orig);
        }
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});

Deno.test('discoverLocales: throws when both folder and flat exist for same locale', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        await Deno.mkdir(`${tmp}/RP/texts/en_US`, { recursive: true });
        await Deno.writeTextFile(`${tmp}/RP/texts/en_US/_root.lang`, 'k=v\n');
        await Deno.writeTextFile(`${tmp}/RP/texts/en_US.lang`, 'k=v\n');
        const orig = Deno.cwd();
        Deno.chdir(tmp);
        try {
            await assertRejects(() => discoverLocales(), Error, 'en_US');
        } finally {
            Deno.chdir(orig);
        }
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});

function makeFileWithComments(path: string): ParsedFile {
    return {
        path,
        lines: [
            { type: 'comment', text: '## Section' },
            { type: 'entry', key: 'key.a', value: 'hello' },
            { type: 'blank' },
            { type: 'entry', key: 'key.b', value: 'world' },
        ],
    };
}

const baseConfig = parseConfig({ referenceLocale: 'en_US' });

Deno.test('emitMerged: output contains banner and section headers', () => {
    const files = [makeFileWithComments('_root.lang')];
    const out = emitMerged(files, 'en_US', baseConfig);
    assert(out.includes('## Auto-merged for en_US'));
    assert(out.includes('## Generated by Rune'));
    assert(out.includes('## --- _root.lang ---'));
    assert(out.includes('key.a=hello'));
    assert(out.includes('key.b=world'));
    assert(out.includes('## Section'));
});

Deno.test('emitMerged: banner shows correct file count and key count', () => {
    const files = [
        makeFile('a.lang', [['k1', 'v1'], ['k2', 'v2']]),
        makeFile('b.lang', [['k3', 'v3']]),
    ];
    const out = emitMerged(files, 'en_US', baseConfig);
    assert(out.includes('## 2 file(s), 3 unique key(s)'));
});

Deno.test('emitMerged: stripComments removes comments, blanks, and headers', () => {
    const files = [makeFileWithComments('_root.lang')];
    const cfg = parseConfig({ referenceLocale: 'en_US', stripComments: true });
    const out = emitMerged(files, 'en_US', cfg);
    assert(!out.includes('##'));
    assert(out.includes('key.a=hello'));
    assert(out.includes('key.b=world'));
});

Deno.test('emitMerged: randomizeEntries produces entries-only output', () => {
    const files = [
        makeFileWithComments('_root.lang'),
        makeFile('b.lang', [['key.c', 'val']]),
    ];
    const cfg = parseConfig({ referenceLocale: 'en_US', randomizeEntries: true });
    const out = emitMerged(files, 'en_US', cfg);
    assert(!out.includes('##'));
    assert(!out.includes('---'));
    assert(out.includes('key.a=hello'));
    assert(out.includes('key.b=world'));
    assert(out.includes('key.c=val'));
});

Deno.test('emitMerged: randomizeEntries preserves all keys', () => {
    const keys = Array.from({ length: 20 }, (_, i) => [`key.${i}`, `val${i}`] as [string, string]);
    const files = [makeFile('test.lang', keys)];
    const cfg = parseConfig({ referenceLocale: 'en_US', randomizeEntries: true });
    const out = emitMerged(files, 'en_US', cfg);
    for (const [k, v] of keys) {
        assert(out.includes(`${k}=${v}`), `Missing ${k}=${v}`);
    }
});

import { computeCoverage } from './coverage.ts';
import type { LocaleCoverage } from './coverage.ts';

Deno.test('computeCoverage: classifies translated, untranslated, missing, stale correctly', () => {
    const refKeyMap = new Map([
        ['a', 'hello'],
        ['b', 'world'],
        ['c', 'foo'],
    ]);
    const refFiles: ParsedFile[] = [{
        path: '_root.lang',
        lines: [
            { type: 'entry', key: 'a', value: 'hello' },
            { type: 'entry', key: 'b', value: 'world' },
            { type: 'entry', key: 'c', value: 'foo' },
        ],
    }];
    const targetKeyMap = new Map([
        ['a', 'hallo'],      // translated (differs)
        ['b', 'world'],      // untranslated (same as reference)
        // 'c' missing
        ['d', 'extra'],      // stale (not in reference)
    ]);

    const cov = computeCoverage(refKeyMap, refFiles, targetKeyMap, 'nl_NL');
    assertEquals(cov.locale, 'nl_NL');
    assertEquals(cov.total, 3);
    assertEquals(cov.translated, 1);
    assertEquals(cov.untranslated, 1);
    assertEquals(cov.missing, 1);
    assertEquals(cov.stale, 1);
    assertEquals(cov.files[0].path, '_root.lang');
    assertEquals(cov.files[0].translated, 1);
    assertEquals(cov.files[0].untranslated, 1);
    assertEquals(cov.files[0].missing, 1);
});

Deno.test('computeCoverage: per-file breakdown uses reference file structure', () => {
    const refKeyMap = new Map([['f1.key', 'v'], ['f2.key', 'v']]);
    const refFiles: ParsedFile[] = [
        { path: 'file1.lang', lines: [{ type: 'entry', key: 'f1.key', value: 'v' }] },
        { path: 'file2.lang', lines: [{ type: 'entry', key: 'f2.key', value: 'v' }] },
    ];
    const targetKeyMap = new Map([['f1.key', 'translated']]);

    const cov = computeCoverage(refKeyMap, refFiles, targetKeyMap, 'de_DE');
    assertEquals(cov.files.length, 2);
    assertEquals(cov.files[0].path, 'file1.lang');
    assertEquals(cov.files[0].translated, 1);
    assertEquals(cov.files[1].path, 'file2.lang');
    assertEquals(cov.files[1].missing, 1);
});

Deno.test('computeCoverage: excluded keys are subtracted from total and skipped', () => {
    const refKeyMap = new Map([['a', 'A'], ['b', 'B'], ['c', 'C']]);
    const refFiles: ParsedFile[] = [{
        path: '_root.lang',
        lines: [
            { type: 'entry', key: 'a', value: 'A' },
            { type: 'entry', key: 'b', value: 'B' },
            { type: 'entry', key: 'c', value: 'C' },
        ],
    }];
    const targetKeyMap = new Map([['a', 'translated']]);
    const excluded = new Set(['b']);

    const cov = computeCoverage(refKeyMap, refFiles, targetKeyMap, 'nl_NL', excluded);
    assertEquals(cov.total, 2);
    assertEquals(cov.translated, 1);
    assertEquals(cov.untranslated, 0);
    assertEquals(cov.missing, 1);
    assertEquals(cov.files[0].total, 2);
    assertEquals(cov.files[0].missing, 1);
});

Deno.test('computeCoverage: empty excluded set behaves like default', () => {
    const refKeyMap = new Map([['a', 'A']]);
    const refFiles: ParsedFile[] = [{
        path: '_root.lang',
        lines: [{ type: 'entry', key: 'a', value: 'A' }],
    }];
    const cov = computeCoverage(refKeyMap, refFiles, new Map(), 'nl_NL', new Set());
    assertEquals(cov.total, 1);
    assertEquals(cov.missing, 1);
});

import { generateReport, writeReport } from './report.ts';

const sampleCoverage: LocaleCoverage = {
    locale: 'nl_NL',
    total: 10,
    translated: 4,
    untranslated: 1,
    missing: 5,
    stale: 2,
    files: [
        { path: '_root.lang', total: 5, translated: 4, untranslated: 1, missing: 0 },
        { path: 'animals/mood.lang', total: 5, translated: 0, untranslated: 0, missing: 5 },
    ],
};

Deno.test('generateReport: summary table contains locale and stats', () => {
    const md = generateReport([sampleCoverage], 'en_US', 10);
    assert(md.includes('`nl_NL`'));
    assert(md.includes('4/10'));
    assert(md.includes('40.0%'));
    assert(md.includes('| 5 |'));
    assert(md.includes('| 1 |'));
    assert(md.includes('| 2 |'));
});

Deno.test('generateReport: per-file breakdown omits 100% translated files', () => {
    const fullyCovered: LocaleCoverage = {
        locale: 'de_DE',
        total: 3,
        translated: 3,
        untranslated: 0,
        missing: 0,
        stale: 0,
        files: [{ path: 'full.lang', total: 3, translated: 3, untranslated: 0, missing: 0 }],
    };
    const md = generateReport([fullyCovered], 'en_US', 3);
    assert(!md.includes('full.lang'));
});

Deno.test('generateReport: per-file section shows incomplete files', () => {
    const md = generateReport([sampleCoverage], 'en_US', 10);
    assert(md.includes('animals/mood.lang'));
    assert(md.includes('_root.lang'));
});

Deno.test('generateReport: summary sorts locales by translation percentage descending', () => {
    const low: LocaleCoverage = {
        locale: 'aa_AA', total: 10, translated: 1, untranslated: 0, missing: 9, stale: 0,
        files: [{ path: 'x.lang', total: 10, translated: 1, untranslated: 0, missing: 9 }],
    };
    const high: LocaleCoverage = {
        locale: 'bb_BB', total: 10, translated: 9, untranslated: 0, missing: 1, stale: 0,
        files: [{ path: 'x.lang', total: 10, translated: 9, untranslated: 0, missing: 1 }],
    };
    const mid: LocaleCoverage = {
        locale: 'cc_CC', total: 10, translated: 5, untranslated: 0, missing: 5, stale: 0,
        files: [{ path: 'x.lang', total: 10, translated: 5, untranslated: 0, missing: 5 }],
    };
    const md = generateReport([low, high, mid], 'en_US', 10);
    const idxHigh = md.indexOf('`bb_BB`');
    const idxMid = md.indexOf('`cc_CC`');
    const idxLow = md.indexOf('`aa_AA`');
    assert(idxHigh < idxMid && idxMid < idxLow, 'summary should be sorted high to low');
});

Deno.test('generateReport: per-file sections follow the same sort order', () => {
    const low: LocaleCoverage = {
        locale: 'aa_AA', total: 10, translated: 1, untranslated: 0, missing: 9, stale: 0,
        files: [{ path: 'x.lang', total: 10, translated: 1, untranslated: 0, missing: 9 }],
    };
    const high: LocaleCoverage = {
        locale: 'bb_BB', total: 10, translated: 5, untranslated: 0, missing: 5, stale: 0,
        files: [{ path: 'x.lang', total: 10, translated: 5, untranslated: 0, missing: 5 }],
    };
    const md = generateReport([low, high], 'en_US', 10);
    const highSection = md.indexOf('`bb_BB` - per-file');
    const lowSection = md.indexOf('`aa_AA` - per-file');
    assert(highSection >= 0 && lowSection >= 0);
    assert(highSection < lowSection, 'higher-coverage locale section should come first');
});

Deno.test('writeReport: creates file at ROOT_DIR/reports/rune_coverage_report.md', async () => {
    const tmp = await Deno.makeTempDir();
    try {
        const path = await writeReport('# Test\n', tmp);
        assert(path.endsWith('rune_coverage_report.md'));
        const content = await Deno.readTextFile(path);
        assertEquals(content, '# Test\n');
    } finally {
        await Deno.remove(tmp, { recursive: true });
    }
});
