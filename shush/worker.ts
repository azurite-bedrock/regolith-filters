/// <reference lib="deno.worker" />

import { join, dirname, basename, extname } from '@std/path';

interface Task {
    batch: string[];
    minify: boolean;
}

interface Result {
    ok: boolean;
    filePath: string;
    outPath?: string;
    error?: string;
}

self.onmessage = async (e: MessageEvent<Task>) => {
    const { batch, minify } = e.data;

    const results: Result[] = await Promise.all(
        batch.map((filePath) => processFile(filePath, minify)),
    );

    self.postMessage(results);
};

async function processFile(filePath: string, minify: boolean): Promise<Result> {
    try {
        const raw = await Deno.readTextFile(filePath);
        const ext = extname(filePath).toLowerCase();
        const isJsonc = ext === '.jsonc';

        // Strip regardless since we know- no one listens to proper json formatting rules...
        // And all Bedrock devs are lazy and put trailing commas and comments in their json files, so we might as well just strip it all out and be done with it.
        const stripped = stripJsonc(raw);
        const parsed = JSON.parse(stripped);
        const output = minify ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 4);

        let outPath = filePath;
        if (isJsonc) {
            const dir = dirname(filePath);
            const name = basename(filePath, '.jsonc');
            outPath = join(dir, name + '.json');
        }

        await Deno.writeTextFile(outPath, output);

        if (isJsonc && outPath !== filePath) {
            await Deno.remove(filePath);
        }

        return { ok: true, filePath, outPath };
    } catch (err) {
        return { ok: false, filePath, error: (err as Error).message };
    }
}

function stripJsonc(input: string): string {
    return input
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
        .replace(/,(?=\s*[\]}])/g, '');
}
