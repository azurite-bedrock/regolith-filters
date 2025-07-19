import { format, parse, SemVer } from "@std/semver";
import { existsSync } from "@std/fs";
import { join } from "@std/path";

const REGOLITH_ROOT_DIR = Deno.env.get("ROOT_DIR")!;
const FILTER_DATA_DIR = "data/dinoscript";
const OUTPUT_FILE = "scripts/main.js";
const BP_MANIFEST_FILE = "BP/manifest.json";

function getUUID() {
    const uuidPath = join(
        REGOLITH_ROOT_DIR,
        "packs/data/dinoscript/uuid.txt",
    );
    if (existsSync(uuidPath)) {
        return Deno.readTextFileSync(uuidPath);
    } else {
        const uuid = crypto.randomUUID();
        Deno.writeTextFileSync(uuidPath, uuid);
        return uuid;
    }
}

class ScriptModule {
    name: string;
    version: SemVer;

    constructor(mod: string) {
        const match = mod.match(/(@[^@]+)@(.+)/);
        if (!match) {
            console.error(
                `module \`${mod}\` must follow this format: \`@foo/bar@<SEMVER>\``,
            );
            Deno.exit(1);
        }
        const [_, name, version] = match;
        this.name = name;
        try {
            this.version = parse(version);
        } catch (_) {
            console.error(
                `module version \`${version}\` does not follow semantic versioning`,
            );
            Deno.exit(1);
        }
    }
}

class Config {
    entry: string = "mod.ts";
    modules: ScriptModule[];
    minify: boolean = true;
    format: "esm" | "cjs" | "iife" = "esm";
    sourcemap?: "linked" | "inline" | "external";

    constructor() {
        const settings = Deno.args[0];
        if (!settings) {
            console.error("`settings` in `config.json` must be defined");
            Deno.exit(1);
        }
        const config = JSON.parse(settings);

        if (typeof config.entryPoints === "string") {
            this.entry = config.entry;
        }

        if (typeof config.minify === "boolean") {
            this.minify = config.minify;
        }

        if (typeof config.format === "string") {
            this.format = config.format;
        }

        if (typeof config.sourcemap === "string") {
            this.sourcemap = config.sourcemap;
        }

        if (
            Array.isArray(config.modules) &&
            config.modules.every((mod: unknown) => typeof mod === "string") &&
            config.modules.length > 0
        ) {
            this.modules = (config.modules as string[]).map((mod) =>
                new ScriptModule(mod)
            );
        } else {
            console.error(
                "`settings.modules` in `config.json` is required",
            );
            Deno.exit(1);
        }
    }
}

interface ManifestModule {
    description?: string;
    type: "script" | "data" | "resources";
    language?: "javascript";
    entry?: string;
    uuid: string;
    version: [number, number, number];
}

interface ManifestDependency {
    module_name: string;
    version: string;
}

class PartialManifest {
    modules: ManifestModule[] = [];
    dependencies: ManifestDependency[] = [];
    rest: Record<string, unknown> = {};

    constructor(modules: ScriptModule[]) {
        const uuid = getUUID();

        if (!existsSync(BP_MANIFEST_FILE, { isFile: true })) {
            console.error(`the BP manifest must exist`);
            Deno.exit(1);
        }
        const manifest = JSON.parse(Deno.readTextFileSync(BP_MANIFEST_FILE));

        if (manifest.dependencies === undefined) {
            manifest.dependencies = [];
        } else if (!Array.isArray(manifest.dependencies)) {
            console.error(
                "BP manifest must contain an array `dependencies` field",
            );
            Deno.exit(1);
        }
        this.dependencies = manifest.dependencies;

        if (manifest.modules === undefined) {
            manifest.modules = [];
        } else if (!Array.isArray(manifest.modules)) {
            console.error(
                "BP manifest must contain an array `modules` field",
            );
            Deno.exit(1);
        }
        this.modules = manifest.modules;

        for (const mod of modules) {
            const formattedVersion = format(mod.version);
            const depAlreadyExists = this.dependencies.some(
                (dep) => {
                    return typeof dep.version === "string" &&
                        dep.module_name === mod.name &&
                        dep.version !== formattedVersion;
                },
            );
            if (depAlreadyExists) {
                console.error(
                    `module \`${mod.name}\` already exists in the BP manifest with a different version`,
                );
                Deno.exit(1);
            } else {
                this.dependencies.push({
                    module_name: mod.name,
                    version: formattedVersion,
                });
            }
        }

        const moduleAlreadyExists = this.modules.some((mod) => {
            return mod.uuid === uuid && mod.entry === OUTPUT_FILE;
        });
        if (moduleAlreadyExists) {
            console.error("found already existing module in BP manifest");
            Deno.exit(1);
        } else {
            this.modules.push({
                description: "Scripting",
                type: "script",
                uuid,
                language: "javascript",
                version: [1, 0, 0],
                entry: OUTPUT_FILE,
            });
        }

        for (const [key, value] of Object.entries(manifest)) {
            if (key !== "modules" && key !== "dependencies") {
                this.rest[key] = value;
            }
        }
    }

    toJSON() {
        return {
            ...this.rest,
            modules: this.modules,
            dependencies: this.dependencies,
        };
    }
}

if (import.meta.main) {
    const config = new Config();

    const partialManifest = new PartialManifest(config.modules);
    Deno.writeTextFileSync(
        BP_MANIFEST_FILE,
        JSON.stringify(partialManifest, null, 4),
    );

    const resolvedOutputFile = join(Deno.cwd(), "BP", OUTPUT_FILE);
    const bundleArgs = [
        "bundle",
        "--output",
        resolvedOutputFile,
        "--format",
        config.format,
    ];
    if (config.minify) bundleArgs.push("--minify");
    if (config.sourcemap) bundleArgs.push(`--sourcemap=${config.sourcemap}`);
    bundleArgs.push(
        ...config.modules.flatMap((mod) => ["--external", mod.name]),
    );
    bundleArgs.push(config.entry);

    const resolvedFilterDataDir = join(Deno.cwd(), FILTER_DATA_DIR);
    new Deno.Command(Deno.execPath(), {
        args: bundleArgs,
        stderr: "inherit",
        stdout: "inherit",
        cwd: resolvedFilterDataDir,
    }).outputSync();
}
