import { exists } from '@std/fs/exists';
import { walk } from '@std/fs/walk';
import { join, relative, extname, SEPARATOR } from '@std/path';

export interface SourceFile {
    absPath: string;
    relPath: string;
}

export interface LocaleEntry {
    locale: string;
    pack: string;
    textsDir: string;
    mode: 'folder' | 'flat';
    sourceFiles: SourceFile[];
}

const SUPPORTED_EXTS = new Set(['.lang', '.json', '.json5']);
const LOCALE_PATTERN = /^[a-z]{2,3}_[A-Z]{2,3}$/;

export async function discoverLocales(): Promise<LocaleEntry[]> {
    const results: LocaleEntry[] = [];

    for (const pack of ['RP', 'BP']) {
        if (!await exists(pack)) continue;
        const textsDir = join(pack, 'texts');
        if (!await exists(textsDir)) continue;

        const localeMap = new Map<string, { hasFolder: boolean; hasFlat: boolean }>();

        for await (const entry of Deno.readDir(textsDir)) {
            const name = entry.name;
            if (entry.isDirectory) {
                if (!LOCALE_PATTERN.test(name)) {
                    console.warn(`Skipping non-locale directory: ${join(textsDir, name)}`);
                    continue;
                }
                const cur = localeMap.get(name) ?? { hasFolder: false, hasFlat: false };
                localeMap.set(name, { ...cur, hasFolder: true });
            } else if (entry.isFile && name.endsWith('.lang')) {
                const locale = name.slice(0, -5);
                if (!LOCALE_PATTERN.test(locale)) {
                    console.warn(`Skipping non-locale file: ${join(textsDir, name)}`);
                    continue;
                }
                const cur = localeMap.get(locale) ?? { hasFolder: false, hasFlat: false };
                localeMap.set(locale, { ...cur, hasFlat: true });
            }
        }

        for (const [locale, { hasFolder, hasFlat }] of localeMap) {
            if (hasFolder && hasFlat) {
                throw new Error(
                    `Both "${join(textsDir, locale)}${SEPARATOR}" and "${join(textsDir, locale)}.lang" exist for locale "${locale}" in ${pack}. Remove one.`,
                );
            }

            if (hasFlat) {
                const flatFile = join(textsDir, `${locale}.lang`);
                results.push({
                    locale,
                    pack,
                    textsDir,
                    mode: 'flat',
                    sourceFiles: [{ absPath: flatFile, relPath: `${locale}.lang` }],
                });
                continue;
            }

            const localeDir = join(textsDir, locale);
            const sourceFiles: SourceFile[] = [];

            for await (const file of walk(localeDir, { includeDirs: false })) {
                const ext = extname(file.name).toLowerCase();
                if (!SUPPORTED_EXTS.has(ext)) {
                    console.warn(`Skipping unsupported file: ${file.path}`);
                    continue;
                }
                const relPath = relative(localeDir, file.path).replace(/\\/g, '/');
                sourceFiles.push({ absPath: file.path, relPath });
            }

            if (sourceFiles.length === 0) {
                console.warn(`Skipping locale "${locale}" in ${pack}: no supported source files found.`);
                continue;
            }

            results.push({ locale, pack, textsDir, mode: 'folder', sourceFiles });
        }
    }

    return results;
}
