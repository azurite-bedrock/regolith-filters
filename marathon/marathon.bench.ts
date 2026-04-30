import { join } from '@std/path/join';

const N = 8;
const PRIME_LIMIT = 100_000;
const STDIN_HOOK = 'await Deno.stdin.read(new Uint8Array(1));';
const SCRIPT_BODY = `
let count = 0;
for (let n = 2; n <= ${PRIME_LIMIT}; n++) {
    let isPrime = true;
    for (let i = 2; i * i <= n; i++) {
        if (n % i === 0) { isPrime = false; break; }
    }
    if (isPrime) count++;
}
`;

const tmpDir = await Deno.makeTempDir({ prefix: 'marathon_bench_' });

for (let i = 0; i < N; i++) {
    await Deno.writeTextFile(join(tmpDir, `script_${i}.ts`), STDIN_HOOK + '\n' + SCRIPT_BODY);
}

const scriptPaths = Array.from({ length: N }, (_, i) => join(tmpDir, `script_${i}.ts`));
const encoder = new TextEncoder();

function spawn_all(): Deno.ChildProcess[] {
    return scriptPaths.map((path) =>
        new Deno.Command(Deno.execPath(), {
            args: ['run', '--allow-read', path],
            stdin: 'piped',
            stdout: 'null',
            stderr: 'null',
        }).spawn(),
    );
}

async function signal_and_await(proc: Deno.ChildProcess): Promise<void> {
    const writer = proc.stdin.getWriter();
    await writer.write(encoder.encode('\n'));
    writer.close();
    await proc.status;
}

Deno.bench('sequential', async () => {
    const procs = spawn_all();
    for (const proc of procs) {
        await signal_and_await(proc);
    }
});

Deno.bench('parallel', async () => {
    const procs = spawn_all();
    await Promise.all(procs.map(signal_and_await));
});

addEventListener('unload', () => {
    Deno.removeSync(tmpDir, { recursive: true });
});
