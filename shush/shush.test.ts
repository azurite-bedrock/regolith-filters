import { assertEquals, assert } from '@std/assert';
import { processText } from './process.ts';
import { parseConfig } from './config.ts';

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
