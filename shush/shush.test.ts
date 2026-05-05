import { assertEquals, assert, assertThrows } from '@std/assert';
import { processText, processJson5Text } from './process.ts';
import { parseConfig } from './config.ts';
import { chunkArray, processFilesInline } from './pipeline.ts';

// processText: comment stripping

Deno.test('strips single-line comments', () => {
    const input = '{\n    "a": 1 // comment\n}';
    const output = processText(input);
    assertEquals(JSON.parse(output), { a: 1 });
});

Deno.test('strips multi-line comments', () => {
    const input = '{\n    /* comment */\n    "a": 1\n}';
    const output = processText(input);
    assertEquals(JSON.parse(output), { a: 1 });
});

Deno.test('preserves comment-like content inside strings', () => {
    const input = '{\n    "url": "http://example.com"\n}';
    const output = processText(input);
    assertEquals(JSON.parse(output).url, 'http://example.com');
});

// processText: trailing commas

Deno.test('removes trailing comma in object', () => {
    const input = '{\n    "a": 1,\n}';
    const output = processText(input);
    assertEquals(JSON.parse(output), { a: 1 });
});

Deno.test('removes trailing comma in array', () => {
    const input = '[\n    1,\n    2,\n]';
    const output = processText(input);
    assertEquals(JSON.parse(output), [1, 2]);
});

// processText: number preservation

Deno.test('preserves 0.0 in non-minified output', () => {
    const input = '{"val": 0.0}';
    const output = processText(input);
    assert(output.includes('0.0'), `Expected "0.0" in output but got:\n${output}`);
});

Deno.test('preserves 1e2 in non-minified output', () => {
    const input = '{"val": 1e2}';
    const output = processText(input);
    assert(output.includes('1e2'), `Expected "1e2" in output but got:\n${output}`);
});

// processText: minification

Deno.test('minify removes all whitespace and newlines', () => {
    const input = '{\n    "a": 1,\n    "b": "hello"\n}';
    const output = processText(input, { minify: true });
    assertEquals(output, '{"a":1,"b":"hello"}');
});

Deno.test('minify strips comments before compacting', () => {
    const input = '{\n    "a": 1 // comment\n}';
    const output = processText(input, { minify: true });
    assertEquals(output, '{"a":1}');
});

Deno.test('minify preserves 0.0', () => {
    const input = '{"val": 0.0}';
    const output = processText(input, { minify: true });
    assertEquals(output, '{"val":0.0}');
});

Deno.test('minify preserves 1e2', () => {
    const input = '{"val": 1e2}';
    const output = processText(input, { minify: true });
    assertEquals(output, '{"val":1e2}');
});

Deno.test('minify preserves whitespace inside string values', () => {
    const input = '{"msg": "hello world"}';
    const output = processText(input, { minify: true });
    assertEquals(output, '{"msg":"hello world"}');
});

Deno.test('minify removes trailing commas', () => {
    const input = '{"a": 1,}';
    const output = processText(input, { minify: true });
    assertEquals(output, '{"a":1}');
});

Deno.test('minify with removeTrailingCommas: false preserves trailing comma', () => {
    const input = '{"a": 1,}';
    const output = processText(input, { minify: true, removeTrailingCommas: false });
    assertEquals(output, '{"a":1,}');
});

// processText: removeTrailingCommas

Deno.test('removeTrailingCommas: false preserves trailing comma in object', () => {
    const input = '{\n    "a": 1,\n}';
    const output = processText(input, { removeTrailingCommas: false });
    assert(output.includes(','), `Expected trailing comma to survive but got:\n${output}`);
});

Deno.test('removeTrailingCommas: false preserves trailing comma in array', () => {
    const input = '[\n    1,\n    2,\n]';
    const output = processText(input, { removeTrailingCommas: false });
    assert(
        output.includes(',\n]') || output.includes(',\n    ]'),
        `Expected trailing comma to survive but got:\n${output}`,
    );
});

// processText: removeComments: false

Deno.test('removeComments: false preserves single-line comments', () => {
    const input = '{\n    "a": 1 // keep me\n}';
    const output = processText(input, { removeComments: false });
    assert(output.includes('// keep me'), `Expected comment to survive but got:\n${output}`);
});

Deno.test('removeComments: false preserves multi-line comments', () => {
    const input = '{\n    /* keep me */\n    "a": 1\n}';
    const output = processText(input, { removeComments: false });
    assert(output.includes('/* keep me */'), `Expected comment to survive but got:\n${output}`);
});

// processText: tabSize

Deno.test('tabSize: 2 produces 2-space indentation', () => {
    const input = '{"a":{"b":1}}';
    const output = processText(input, { tabSize: 2 });
    assert(output.includes('  "b"'), `Expected 2-space indent but got:\n${output}`);
});

Deno.test('tabSize: 4 (default) produces 4-space indentation', () => {
    const input = '{"a":{"b":1}}';
    const output = processText(input);
    assert(output.includes('    "b"'), `Expected 4-space indent but got:\n${output}`);
});

// parseConfig

Deno.test('parseConfig returns defaults when arg is undefined', () => {
    const cfg = parseConfig(undefined);
    assertEquals(cfg.removeComments, true);
    assertEquals(cfg.removeTrailingCommas, true);
    assertEquals(cfg.minify, false);
    assertEquals(cfg.jsonc, true);
    assertEquals(cfg.batchSize, 20);
    assertEquals(cfg.tabSize, 4);
});

Deno.test('parseConfig returns defaults when arg is invalid JSON', () => {
    const cfg = parseConfig('not json {{{');
    assertEquals(cfg.removeComments, true);
    assertEquals(cfg.minify, false);
});

Deno.test('parseConfig merges provided keys over defaults', () => {
    const cfg = parseConfig('{"minify": true, "tabSize": 2}');
    assertEquals(cfg.minify, true);
    assertEquals(cfg.tabSize, 2);
    assertEquals(cfg.removeComments, true); // default preserved
});

Deno.test('parseConfig handles empty object arg', () => {
    const cfg = parseConfig('{}');
    assertEquals(cfg.removeComments, true);
    assertEquals(cfg.batchSize, 20);
});

// chunkArray

Deno.test('chunkArray splits into correct chunks', () => {
    assertEquals(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

Deno.test('chunkArray returns single chunk when size >= length', () => {
    assertEquals(chunkArray([1, 2, 3], 10), [[1, 2, 3]]);
});

Deno.test('chunkArray returns empty array for empty input', () => {
    assertEquals(chunkArray([], 5), []);
});

Deno.test('chunkArray throws RangeError for size <= 0', () => {
    assertThrows(() => chunkArray([1, 2, 3], 0), RangeError);
    assertThrows(() => chunkArray([1, 2, 3], -1), RangeError);
});

// processFilesInline

Deno.test('processFilesInline strips comments from a json file', async () => {
    const dir = await Deno.makeTempDir();
    const path = `${dir}/test.json`;
    await Deno.writeTextFile(path, '{\n    "a": 1 // comment\n}');
    const results = await processFilesInline([path], {
        removeComments: true,
        removeTrailingCommas: true,
    });
    assertEquals(results.length, 1);
    assertEquals(results[0].ok, true);
    const content = await Deno.readTextFile(path);
    assertEquals(JSON.parse(content), { a: 1 });
    await Deno.remove(dir, { recursive: true });
});

Deno.test('processFilesInline returns error result on unreadable file', async () => {
    const results = await processFilesInline(['/nonexistent/missing.json'], {});
    assertEquals(results.length, 1);
    assertEquals(results[0].ok, false);
    assert(results[0].error !== undefined);
});

Deno.test('processFilesInline renames .jsonc to .json and deletes original', async () => {
    const dir = await Deno.makeTempDir();
    const jsoncPath = `${dir}/test.jsonc`;
    const jsonPath = `${dir}/test.json`;
    await Deno.writeTextFile(jsoncPath, '{\n    "a": 1 // comment\n}');
    const results = await processFilesInline([jsoncPath], {
        removeComments: true,
        removeTrailingCommas: true,
    });
    assertEquals(results.length, 1);
    assertEquals(results[0].ok, true);
    // .json output was written
    const content = await Deno.readTextFile(jsonPath);
    assertEquals(JSON.parse(content), { a: 1 });
    // original .jsonc was deleted
    let threw = false;
    try {
        await Deno.stat(jsoncPath);
    } catch {
        threw = true;
    }
    assert(threw, 'Expected .jsonc file to be deleted');
    await Deno.remove(dir, { recursive: true });
});

// parseConfig: json5 option

Deno.test('parseConfig returns json5: true by default', () => {
    const cfg = parseConfig(undefined);
    assertEquals(cfg.json5, true);
});

Deno.test('parseConfig respects json5: false', () => {
    const cfg = parseConfig('{"json5": false}');
    assertEquals(cfg.json5, false);
});

// processJson5Text

Deno.test('processJson5Text handles unquoted keys', () => {
    const input = '{key: "value"}';
    const output = processJson5Text(input);
    assertEquals(JSON.parse(output), { key: 'value' });
});

Deno.test('processJson5Text handles single-quoted strings', () => {
    const input = "{'key': 'value'}";
    const output = processJson5Text(input);
    assertEquals(JSON.parse(output), { key: 'value' });
});

Deno.test('processJson5Text converts hex numbers to decimal', () => {
    const input = '{value: 0xFF}';
    const output = processJson5Text(input);
    assertEquals(JSON.parse(output), { value: 255 });
});

Deno.test('processJson5Text with minify: true produces compact output', () => {
    const input = '{\n    key: "value",\n    n: 0xFF,\n}';
    const output = processJson5Text(input, { minify: true });
    assertEquals(output, '{"key":"value","n":255}');
});

Deno.test('processJson5Text applies tabSize formatting', () => {
    const input = '{key: {nested: 1}}';
    const output = processJson5Text(input, { tabSize: 2 });
    assert(output.includes('  "nested"'), `Expected 2-space indent but got:\n${output}`);
});

Deno.test('processJson5Text strips trailing commas from re-serialized output', () => {
    // JSON.stringify never produces trailing commas, but processText still runs.
    // Verify the round-trip produces valid JSON.
    const input = '{key: "val", arr: [1, 2,],}';
    const output = processJson5Text(input);
    assertEquals(JSON.parse(output), { key: 'val', arr: [1, 2] });
});

Deno.test('processFilesInline renames .json5 to .json and deletes original', async () => {
    const dir = await Deno.makeTempDir();
    const json5Path = `${dir}/test.json5`;
    const jsonPath = `${dir}/test.json`;
    await Deno.writeTextFile(json5Path, '{key: "value", n: 0xFF}');
    const results = await processFilesInline([json5Path], {
        removeComments: true,
        removeTrailingCommas: true,
    });
    assertEquals(results.length, 1);
    assertEquals(results[0].ok, true);
    const content = await Deno.readTextFile(jsonPath);
    assertEquals(JSON.parse(content), { key: 'value', n: 255 });
    let threw = false;
    try {
        await Deno.stat(json5Path);
    } catch {
        threw = true;
    }
    assert(threw, 'Expected .json5 file to be deleted');
    await Deno.remove(dir, { recursive: true });
});
