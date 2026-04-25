/// <reference lib="deno.worker" />

import { join, dirname, basename, extname } from '@std/path';
import { processText } from './process.ts';
import type { ProcessOptions } from './process.ts';

interface Task {
    batch: string[];
    options: ProcessOptions;
}

interface Result {
    ok: boolean;
    filePath: string;
    outPath?: string;
    error?: string;
}

self.onmessage = async (e: MessageEvent<Task>) => {
    const { batch, options } = e.data;

    const results: Result[] = await Promise.all(
        batch.map((filePath) => processFile(filePath, options)),
    );

    self.postMessage(results);
};

async function processFile(filePath: string, options: ProcessOptions): Promise<Result> {
    try {
        const raw = await Deno.readTextFile(filePath);
        const ext = extname(filePath).toLowerCase();
        const isJsonc = ext === '.jsonc';

        const output = processText(raw, options);

        let outPath = filePath;
        if (isJsonc) {
            const dir = dirname(filePath);
            const name = basename(filePath, '.jsonc');
            outPath = join(dir, name + '.json');
        }

        // Skip write if content is unchanged and no rename needed
        if (output === raw && outPath === filePath) {
            return { ok: true, filePath, outPath };
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
