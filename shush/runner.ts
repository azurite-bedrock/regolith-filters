new Deno.Command(Deno.execPath(), {
    args: ['run', '--allow-all', '--unstable-raw-imports', import.meta.dirname + '/shush.ts'],
    stdout: 'inherit',
    stderr: 'inherit',
}).spawn();
