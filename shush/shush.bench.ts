import { chunkArray, buildWorkerPool, runPool, processFilesInline } from './pipeline.ts';
import type { ProcessOptions } from './process.ts';

const CPU = Math.min(Math.max(navigator.hardwareConcurrency ?? 4, 4), 32);
const WORKER_URL = new URL('./worker.ts', import.meta.url);
const OPTIONS: ProcessOptions = { removeComments: true, removeTrailingCommas: true };

// --- Fixture generation ---

function generateJsonContent(seed: number): string {
    return JSON.stringify(
        {
            format_version: '1.16.0',
            seed,
            items: Array.from({ length: 20 + (seed % 30) }, (_, i) => ({
                id: `item_${seed}_${i}`,
                value: seed * 0.1 + i,
                enabled: i % 2 === 0,
                tags: [`tag_${i}`, `category_${seed % 5}`],
            })),
            metadata: {
                description: `Generated fixture ${seed}`,
                version: `1.${seed % 10}.0`,
                flags: Array.from({ length: 5 }, (_, j) => `flag_${seed}_${j}`),
            },
        },
        null,
        4,
    );
}

async function generateFixtures(dir: string, count: number): Promise<Map<string, string>> {
    const snapshot = new Map<string, string>();
    const writes: Promise<void>[] = [];
    for (let i = 0; i < count; i++) {
        const content = generateJsonContent(i);
        const path = `${dir}/file_${i}.json`;
        snapshot.set(path, content);
        writes.push(Deno.writeTextFile(path, content));
    }
    await Promise.all(writes);
    return snapshot;
}

async function restoreFixtures(snapshot: Map<string, string>): Promise<void> {
    await Promise.all(
        [...snapshot.entries()].map(([path, content]) => Deno.writeTextFile(path, content)),
    );
}

// --- Setup (top-level await, runs once before benches) ---

const SMALL_DIR = await Deno.makeTempDir({ prefix: 'shush_bench_small_' });
const MEDIUM_DIR = await Deno.makeTempDir({ prefix: 'shush_bench_medium_' });
const LARGE_DIR = await Deno.makeTempDir({ prefix: 'shush_bench_large_' });

const smallSnap = await generateFixtures(SMALL_DIR, 12);
const mediumSnap = await generateFixtures(MEDIUM_DIR, 200);
const largeSnap = await generateFixtures(LARGE_DIR, 2000);

addEventListener('unload', () => {
    try {
        Deno.removeSync(SMALL_DIR, { recursive: true });
        Deno.removeSync(MEDIUM_DIR, { recursive: true });
        Deno.removeSync(LARGE_DIR, { recursive: true });
    } catch {
        /* ignore */
    }
});

// --- Pool bench helper ---

async function runPoolBench(
    snap: Map<string, string>,
    batchSize: number,
    workerCount: number,
): Promise<void> {
    await restoreFixtures(snap);
    const files = [...snap.keys()];
    const batches = chunkArray(files, batchSize);
    const pool = buildWorkerPool(WORKER_URL, workerCount);
    await runPool(batches, pool, OPTIONS);
    for (const w of pool) w.terminate();
}

// --- Small scale: 12 files ---

for (const batchSize of [1, 5, 20]) {
    for (const workerCount of [1, 4, CPU]) {
        const wLabel = workerCount === CPU ? 'CPU' : String(workerCount);
        Deno.bench(`small  batchSize=${batchSize}  workers=${wLabel}`, async () => {
            await runPoolBench(smallSnap, batchSize, workerCount);
        });
    }
}

Deno.bench('small  inline', async () => {
    await restoreFixtures(smallSnap);
    await processFilesInline([...smallSnap.keys()], OPTIONS);
});

// --- Medium scale: 200 files ---

for (const batchSize of [1, 10, 20, 50]) {
    for (const workerCount of [1, 4, CPU]) {
        const wLabel = workerCount === CPU ? 'CPU' : String(workerCount);
        Deno.bench(`medium batchSize=${batchSize}  workers=${wLabel}`, async () => {
            await runPoolBench(mediumSnap, batchSize, workerCount);
        });
    }
}

Deno.bench('medium batchSize=auto workers=CPU', async () => {
    const auto = Math.ceil(200 / CPU);
    await runPoolBench(mediumSnap, auto, CPU);
});

Deno.bench('medium inline', async () => {
    await restoreFixtures(mediumSnap);
    await processFilesInline([...mediumSnap.keys()], OPTIONS);
});

// --- Large scale: 2000 files ---

for (const batchSize of [10, 20, 50, 100]) {
    for (const workerCount of [1, 4, 8, CPU]) {
        const wLabel = workerCount === CPU ? 'CPU' : String(workerCount);
        Deno.bench(`large  batchSize=${batchSize} workers=${wLabel}`, async () => {
            await runPoolBench(largeSnap, batchSize, workerCount);
        });
    }
}

Deno.bench('large  batchSize=auto workers=CPU', async () => {
    const auto = Math.ceil(2000 / CPU);
    await runPoolBench(largeSnap, auto, CPU);
});

Deno.bench('large  inline', async () => {
    await restoreFixtures(largeSnap);
    await processFilesInline([...largeSnap.keys()], OPTIONS);
});
