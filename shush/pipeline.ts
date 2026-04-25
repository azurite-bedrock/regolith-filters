import { join, dirname, basename, extname } from '@std/path';
import { processText } from './process.ts';
import type { ProcessOptions } from './process.ts';

export interface WorkerResult {
    ok: boolean;
    filePath: string;
    error?: string;
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
    if (size <= 0) throw new RangeError(`chunkArray: size must be > 0, got ${size}`);
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

export function buildWorkerPool(workerUrl: URL, size: number): Worker[] {
    return Array.from({ length: size }, () => new Worker(workerUrl, { type: 'module' }));
}

export function processBatch(
    worker: Worker,
    batch: string[],
    options: ProcessOptions,
): Promise<WorkerResult[]> {
    // Safe to reassign handlers: runPool ensures each worker processes one batch at a time.
    return new Promise((resolve) => {
        worker.onmessage = (e) => resolve(e.data as WorkerResult[]);
        worker.onerror = (e) =>
            resolve(batch.map((filePath) => ({ ok: false, filePath, error: e.message })));
        worker.postMessage({ batch, options });
    });
}

export async function runPool(
    batches: string[][],
    workers: Worker[],
    options: ProcessOptions,
): Promise<WorkerResult[]> {
    const allResults: WorkerResult[] = [];
    const queue = [...batches];
    const idle = [...workers];
    const executing = new Set<Promise<void>>();

    function dispatch(): void {
        while (idle.length > 0 && queue.length > 0) {
            const worker = idle.pop()!;
            const batch = queue.shift()!;
            let p: Promise<void>;
            p = processBatch(worker, batch, options).then((results) => {
                allResults.push(...results);
                executing.delete(p);
                idle.push(worker);
                dispatch();
            });
            executing.add(p);
        }
    }

    dispatch();
    while (executing.size > 0) {
        await Promise.race(executing);
    }
    return allResults;
}

export async function processFilesInline(
    files: string[],
    options: ProcessOptions,
): Promise<WorkerResult[]> {
    return Promise.all(files.map((filePath) => processFileInline(filePath, options)));
}

async function processFileInline(
    filePath: string,
    options: ProcessOptions,
): Promise<WorkerResult> {
    try {
        const raw = await Deno.readTextFile(filePath);
        const ext = extname(filePath).toLowerCase();
        const isJsonc = ext === '.jsonc';
        const output = processText(raw, options);
        let outPath = filePath;
        if (isJsonc) {
            outPath = join(dirname(filePath), basename(filePath, '.jsonc') + '.json');
        }
        if (output === raw && outPath === filePath) {
            return { ok: true, filePath };
        }
        await Deno.writeTextFile(outPath, output);
        if (isJsonc && outPath !== filePath) {
            await Deno.remove(filePath);
        }
        return { ok: true, filePath };
    } catch (err) {
        return { ok: false, filePath, error: (err as Error).message };
    }
}
