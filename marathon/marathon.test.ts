import { assertEquals } from '@std/assert';
import { load_config } from './config.ts';
import { patch_files } from './discover.ts';
import { cleanup } from './runner.ts';

const STDIN_HOOK = 'await Deno.stdin.read(new Uint8Array(1));';

Deno.test('load_config: returns defaults when args are missing or invalid', () => {
    // In test context Deno.args[0] is undefined, so JSON.parse throws → fallback
    const config = load_config();
    assertEquals(config.root_dir, './');
    assertEquals(config.include, ['data/marathon/**/*.ts', 'data/marathon/**/*.js']);
    assertEquals(config.exclude, ['data/**/*.ts', 'data/**/*.js']);
});

Deno.test('patch_files: prepends hook to an unpatched file', async () => {
    const tmp = await Deno.makeTempFile({ suffix: '.ts' });
    try {
        await Deno.writeTextFile(tmp, 'console.log("hello");');
        await patch_files([{ path: tmp }]);
        const content = await Deno.readTextFile(tmp);
        assertEquals(content, STDIN_HOOK + '\nconsole.log("hello");');
    } finally {
        await Deno.remove(tmp);
    }
});

Deno.test('patch_files: does not modify an already-patched file', async () => {
    const tmp = await Deno.makeTempFile({ suffix: '.ts' });
    try {
        const original = STDIN_HOOK + '\nconsole.log("hello");';
        await Deno.writeTextFile(tmp, original);
        await patch_files([{ path: tmp }]);
        const content = await Deno.readTextFile(tmp);
        assertEquals(content, original);
    } finally {
        await Deno.remove(tmp);
    }
});

Deno.test('patch_files: skips files with skip=true', async () => {
    const tmp = await Deno.makeTempFile({ suffix: '.ts' });
    try {
        await Deno.writeTextFile(tmp, 'console.log("hello");');
        await patch_files([{ path: tmp, skip: true }]);
        const content = await Deno.readTextFile(tmp);
        assertEquals(content, 'console.log("hello");');
    } finally {
        await Deno.remove(tmp);
    }
});

Deno.test('cleanup: removes all specified files in parallel', async () => {
    const paths = await Promise.all([
        Deno.makeTempFile({ suffix: '.ts' }),
        Deno.makeTempFile({ suffix: '.ts' }),
        Deno.makeTempFile({ suffix: '.ts' }),
    ]);

    await cleanup(paths.map((path) => ({ path })));

    for (const path of paths) {
        let exists = true;
        try {
            await Deno.stat(path);
        } catch {
            exists = false;
        }
        assertEquals(exists, false, `expected ${path} to be removed`);
    }
});
