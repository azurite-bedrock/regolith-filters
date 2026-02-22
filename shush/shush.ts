import { walk } from '@std/fs/walk';
import WORKER_CODE from './worker.ts' with { type: 'text' };

if (!import.meta.main) Deno.exit(1);

interface Config {
    minify: boolean;
    jsonc: boolean;
    batchSize: number;
}

const config: Config = JSON.parse(
    Deno.args[0] || '{ "minify": true, "jsonc": true, "batchSize": 20 }',
);

const exts = ['json'];
if (config.jsonc) exts.push('jsonc');

// Collect all target files first
const files: string[] = [];
for await (const entry of walk('./', {
    exts,
    includeDirs: false,
})) {
    files.push(entry.path);
}

if (files.length === 0) {
    console.log('No files found.');
    Deno.exit(0);
}

console.log(`Processing ${files.length} file(s)...`);

const startTime = performance.now();

// Concurrency limit — use CPU count, floor at 4, cap at 32
const concurrency = Math.min(Math.max(navigator.hardwareConcurrency ?? 4, 4), 32);

const workerUrl = URL.createObjectURL(
    new Blob([WORKER_CODE], { type: 'application/typescript' }),
);

let processed = 0;
let errors = 0;

// Split files into batches
function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

const batches = chunkArray(files, config.batchSize);

// Create a fixed pool of workers — reused across all batches
const pool = Array.from(
    { length: concurrency },
    () => new Worker(workerUrl, { type: 'module' }),
);

function processBatch(worker: Worker, batch: string[]): Promise<void> {
    return new Promise((resolve) => {
        worker.onmessage = (e) => {
            const results: { ok: boolean; filePath: string; error?: string }[] = e.data;
            for (const { ok, filePath, error } of results) {
                if (ok) {
                    processed++;
                    if (processed % 100 === 0) {
                        console.log(`\t - ${processed}/${files.length} done…`);
                    }
                } else {
                    errors++;
                    console.error(`\t - ${filePath}: ${error}`);
                }
            }
            resolve();
        };
        worker.onerror = (e) => {
            errors += batch.length;
            console.error(`\t - Worker error for batch: ${e.message}`);
            resolve();
        };
        worker.postMessage({ batch, minify: config.minify });
    });
}

// Run batches with bounded concurrency over the fixed worker pool
async function runPool(batches: string[][], workers: Worker[]): Promise<void> {
    const queue = [...batches];
    const idle = [...workers];
    const executing = new Set<Promise<void>>();

    function dispatch(): void {
        while (idle.length > 0 && queue.length > 0) {
            const worker = idle.pop()!;
            const batch = queue.shift()!;
            const p: Promise<void> = processBatch(worker, batch).then(() => {
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
}

await runPool(batches, pool);

// Clean up workers
for (const w of pool) w.terminate();
URL.revokeObjectURL(workerUrl);

const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
console.log(`\nDone in ${elapsed}s — ${processed} succeeded, ${errors} failed.`);
