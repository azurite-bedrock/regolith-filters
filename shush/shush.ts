import { walk } from '@std/fs/walk';
import { globToRegExp } from '@std/path/glob-to-regexp';
import { parseConfig } from './config.ts';
import type { ProcessOptions } from './process.ts';

if (!import.meta.main) Deno.exit(1);

const config = parseConfig(Deno.args[0]);

const exts = ['json'];
if (config.jsonc) exts.push('jsonc');

// Collect all target files
const files: string[] = [];
for await (const entry of walk('./', {
    exts,
    includeDirs: false,
    skip: [globToRegExp('data/**')],
})) {
    files.push(entry.path);
}

if (files.length === 0) {
    console.log('No files found.');
    Deno.exit(0);
}

console.log(`Processing ${files.length} file(s)...`);

const startTime = performance.now();

// Sort largest-first: big files start early, preventing a slow tail batch
const fileSizes = await Promise.all(
    files.map(async (p) => ({ path: p, size: (await Deno.stat(p)).size })),
);
fileSizes.sort((a, b) => b.size - a.size);
const sortedFiles = fileSizes.map((f) => f.path);

// Concurrency limit — use CPU count, floor at 4, cap at 32
const concurrency = Math.min(Math.max(navigator.hardwareConcurrency ?? 4, 4), 32);

// File URL worker — allows worker.ts to use relative imports (process.ts etc.)
const workerUrl = new URL('./worker.ts', import.meta.url);

let processed = 0;
let errors = 0;

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

const batches = chunkArray(sortedFiles, config.batchSize);

const pool = Array.from(
    { length: concurrency },
    () => new Worker(workerUrl, { type: 'module' }),
);

const options: ProcessOptions = {
    removeComments: config.removeComments,
    removeTrailingCommas: config.removeTrailingCommas,
    minify: config.minify,
    tabSize: config.tabSize,
};

interface WorkerResult {
    ok: boolean;
    filePath: string;
    error?: string;
}

function processBatch(worker: Worker, batch: string[]): Promise<void> {
    return new Promise((resolve) => {
        worker.onmessage = (e) => {
            const results: WorkerResult[] = e.data;
            for (const { ok, filePath, error } of results) {
                if (ok) {
                    processed++;
                    if (processed % 100 === 0) {
                        console.log(`   - ${processed}/${sortedFiles.length} done…`);
                    }
                } else {
                    errors++;
                    console.error(`   - ${filePath}: ${error}`);
                }
            }
            resolve();
        };
        worker.onerror = (e) => {
            errors += batch.length;
            console.error(`   - Worker error for batch: ${e.message}`);
            resolve();
        };
        worker.postMessage({ batch, options });
    });
}

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

for (const w of pool) w.terminate();

const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
console.log(`\nDone in ${elapsed}s — ${processed} succeeded, ${errors} failed.`);
