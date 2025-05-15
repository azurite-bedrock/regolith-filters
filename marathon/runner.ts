import { walk } from "@std/fs";
import { dirname } from "@std/path/dirname";

interface Config {
  root_dir?: string;
}

interface Generator {
  path: string;
  name: string;
  process: Deno.ChildProcess;
}

function load_config() {
  try {
    const config = JSON.parse(Deno.args[0]) as Config;

    if (!config.root_dir) {
      console.error('Settings object must contain a "root_dir"');
    }

    return config;
  } catch {
    return {
      root_dir: "./",
    };
  }
}

const config = load_config();
const real_path = await Deno.realPath(config.root_dir!);

const task_queue: Array<Generator> = new Array(0);
let building = 0;

Deno.chdir(config.root_dir!);

for await (
  const file of walk("./", {
    includeDirs: false,
    followSymlinks: true,
    canonicalize: true,
    exts: ["ts"],
  })
) {
  if (file.path.startsWith("data")) {
    continue;
  }

  building++;

  const file_data = await Deno.readTextFile(file.path);

  if (!file_data.startsWith("await Deno.stdin.read(new Uint8Array(1));")) {
    const data = "await Deno.stdin.read(new Uint8Array(1));\n" + file_data;

    await Deno.writeTextFile(file.path, data);
  }

  const process = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-all", await Deno.realPath(file.path)],
    env: {
      ROOT_DIR: real_path, // Set the environment variable here
    },
    cwd: dirname(file.path),
    stdin: "piped",
    stderr: "inherit",
    stdout: "inherit",
  });

  task_queue.push({
    path: file.path,
    name: file.name,
    process: process.spawn(),
  });

  building--;
}

while (building != 0 || task_queue.length != 0) {
  if (task_queue.length == 0) {
    continue;
  }

  const cmd = task_queue.pop()!;

  console.log(`Invoking ${cmd.name}`);

  const writer = cmd.process.stdin.getWriter();
  await writer.write(new TextEncoder().encode("\n"));
  writer.close();

  const status = await cmd.process.status;
  await Deno.remove(cmd.path);

  if (!status.success) Deno.exit(status.code);
}
