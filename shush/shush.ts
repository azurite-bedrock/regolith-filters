import { walk } from '@std/fs/walk';
import { globToRegExp } from '@std/path/glob-to-regexp';
import { parseConfig } from './config.ts';
import { chunkArray, buildWorkerPool, runPool, processFilesInline } from './pipeline.ts';
import type { WorkerResult } from './pipeline.ts';
import type { ProcessOptions } from './process.ts';

if (!import.meta.main) Deno.exit(1);

const config = parseConfig(Deno.args[0]);

const exts = ['json'];
if (config.jsonc) exts.push('jsonc');
if (config.json5) exts.push('json5');

const files: string[] = [];
for await (const entry of walk('./', {
    exts,
    includeDirs: false,
    followSymlinks: true,
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

const concurrency = Math.min(Math.max(navigator.hardwareConcurrency ?? 4, 4), 32);

const options: ProcessOptions = {
    removeComments: config.removeComments,
    removeTrailingCommas: config.removeTrailingCommas,
    minify: config.minify,
    tabSize: config.tabSize,
};

// Worker startup cost (~50ms per worker) dominates for small-to-medium file counts.
// Inline Promise.all parallelises I/O without spawning any workers.
const INLINE_THRESHOLD = 500;

let results: WorkerResult[];

if (files.length <= INLINE_THRESHOLD) {
    results = await processFilesInline(files, options);
} else {
    // Sort largest-first so the worker queue finishes with balanced tail batches.
    const fileSizes = await Promise.all(
        files.map(async (p) => ({ path: p, size: (await Deno.stat(p)).size })),
    );
    fileSizes.sort((a, b) => b.size - a.size);
    const sortedFiles = fileSizes.map((f) => f.path);

    const batchSize = config.batchSize;
    const batches = chunkArray(sortedFiles, batchSize);
    const workerUrl = new URL('./worker.ts', import.meta.url);
    // Cap to actual batch count — excess workers init but never receive work.
    const workerCount = Math.min(concurrency, batches.length);
    const pool = buildWorkerPool(workerUrl, workerCount);
    results = await runPool(batches, pool, options);
    for (const w of pool) w.terminate();
}

let processed = 0;
let errors = 0;
for (const { ok, filePath, error } of results) {
    if (ok) {
        processed++;
        if (processed % 100 === 0 && processed < files.length) {
            console.log(`   - ${processed}/${files.length} done…`);
        }
    } else {
        errors++;
        console.error(`   - ${filePath}: ${error}`);
    }
}
console.log(`   - ${processed}/${files.length} done…`);

const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
console.log(`Done in ${elapsed}s - ${processed} succeeded, ${errors} failed.`);
