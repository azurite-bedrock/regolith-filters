import { walk } from '@std/fs';
import { SEPARATOR } from '@std/path/constants';
import { globToRegExp } from '@std/path/glob-to-regexp';
import { relative } from '@std/path/relative';
import type { Config } from './config.ts';

export interface DiscoveredFile {
    path: string;
    skip?: boolean;
}

const STDIN_HOOK = 'await Deno.stdin.read(new Uint8Array(1));';

export async function discover_files(
    config: Config,
    rootDir: string,
): Promise<DiscoveredFile[]> {
    const includePatterns = (config.include ?? []).map((pattern) =>
        globToRegExp(pattern, { extended: true, globstar: true }),
    );
    const excludePatterns = (config.exclude ?? []).map((pattern) =>
        globToRegExp(pattern, { extended: true, globstar: true }),
    );

    const files: DiscoveredFile[] = [];
    for await (const file of walk(rootDir, {
        includeDirs: false,
        followSymlinks: true,
        canonicalize: true,
        exts: ['ts', 'js'],
    })) {
        const path = file.path;
        const skip =
            // Skip custom library files
            path.endsWith('.lib.ts') ||
            path.endsWith('.lib.js') ||
            // Skip Deno test files
            path.endsWith('.test.ts') ||
            path.endsWith('.test.js') ||
            // Skip type definition files
            path.endsWith('.d.ts') ||
            path.endsWith('.d.js')
                ? true
                : undefined;

        const relativePath = relative(rootDir, path);
        const normalizedRelativePath = relativePath.split(SEPARATOR).join('/');
        const matchesInclude = includePatterns.some((regex) =>
            regex.test(normalizedRelativePath),
        );
        const matchesExclude = excludePatterns.some((regex) =>
            regex.test(normalizedRelativePath),
        );

        if (includePatterns.length > 0 && !matchesInclude) continue;
        if (excludePatterns.length > 0 && matchesExclude && !matchesInclude) continue;

        files.push({ path, skip });
    }
    return files;
}

export async function patch_files(files: DiscoveredFile[]): Promise<void> {
    await Promise.all(
        files
            .filter((f) => !f.skip)
            .map(async (file) => {
                const content = await Deno.readTextFile(file.path);
                if (!content.startsWith(STDIN_HOOK)) {
                    await Deno.writeTextFile(file.path, STDIN_HOOK + '\n' + content);
                }
            }),
    );
}
