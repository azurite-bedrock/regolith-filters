import { parseConfig, type Config } from './config.ts';
import { discoverLocales } from './discover.ts';
import { parseFile } from './parse.ts';
import { collectEntries, validateStructure, emitMerged } from './merge.ts';
import { computeCoverage } from './coverage.ts';
import { generateReport, writeReport } from './report.ts';
import type { ParsedFile } from './parse.ts';
import type { LocaleCoverage } from './coverage.ts';
import { join } from '@std/path';

function fail(msg: string): never {
    console.error(msg);
    Deno.exit(1);
}

if (import.meta.main) {
    const rootDir = Deno.env.get('ROOT_DIR');
    if (!rootDir) fail('ROOT_DIR environment variable is not set');

    let config: Config;
    try {
        const raw = Deno.args[0] ? JSON.parse(Deno.args[0]) : {};
        config = parseConfig(raw);
    } catch (e) {
        fail((e as Error).message);
    }

    const start = performance.now();

    let localeEntries;
    try {
        localeEntries = await discoverLocales();
    } catch (e) {
        fail((e as Error).message);
    }

    if (!localeEntries.some((e) => e.locale === config.referenceLocale)) {
        fail(`Reference locale "${config.referenceLocale}" was not found in any pack`);
    }

    // Parse all source files
    const parsedMap = new Map<string, ParsedFile[]>();

    for (const entry of localeEntries) {
        const key = `${entry.pack}:${entry.locale}`;
        const files: ParsedFile[] = [];

        for (const src of entry.sourceFiles) {
            let parsed: ParsedFile;
            try {
                parsed = await parseFile(src.absPath, src.relPath);
            } catch (e) {
                fail((e as Error).message);
            }
            files.push(parsed);
            if (entry.mode === 'folder') {
                const entryCount = parsed.lines.filter((l) => l.type === 'entry').length;
                console.info(`   + [${entry.locale}] ${src.relPath} (${entryCount} lines)`);
            }
        }

        parsedMap.set(key, files);
    }

    // Structure enforcement
    if (config.enforceStructure) {
        for (const entry of localeEntries) {
            if (entry.locale === config.referenceLocale || entry.mode === 'flat') continue;
            const refKey = `${entry.pack}:${config.referenceLocale}`;
            const refFiles = parsedMap.get(refKey);
            if (!refFiles) continue;
            try {
                validateStructure(refFiles, parsedMap.get(`${entry.pack}:${entry.locale}`)!, entry.locale);
            } catch (e) {
                fail((e as Error).message);
            }
        }
    }

    // Collect entries and validate duplicates
    const keyMaps = new Map<string, Map<string, string>>();

    for (const [key, files] of parsedMap) {
        try {
            const entryMap = collectEntries(files);
            keyMaps.set(key, new Map([...entryMap.entries()].map(([k, v]) => [k, v.value])));
        } catch (e) {
            fail((e as Error).message);
        }
    }

    // Write merged output
    let totalFiles = 0;
    let totalLines = 0;

    for (const entry of localeEntries) {
        if (entry.mode === 'flat') continue;
        const key = `${entry.pack}:${entry.locale}`;
        const files = parsedMap.get(key)!;
        const outPath = join(entry.textsDir, `${entry.locale}.lang`);

        try {
            await Deno.remove(outPath);
        } catch { /* file doesn't exist yet */ }

        await Deno.writeTextFile(outPath, emitMerged(files, entry.locale, config));
        totalFiles += files.length;
        totalLines += files.reduce(
            (s, f) => s + f.lines.filter((l) => l.type === 'entry').length,
            0,
        );
    }

    // Coverage
    if (config.coverage || config.errorOnMissingTranslations) {
        // Load exclusion list from texts folders
        const excluded = new Set<string>();
        for (const pack of ['RP', 'BP']) {
            try {
                const raw = await Deno.readTextFile(join(pack, 'texts', 'exclusion.json'));
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    for (const k of arr) {
                        if (typeof k === 'string') excluded.add(k);
                    }
                }
            } catch { /* file absent or invalid, skip */ }
        }

        // Build global reference key map (union across all packs)
        const refKeyMap = new Map<string, string>();
        const refFilesList: ParsedFile[] = [];

        for (const entry of localeEntries) {
            if (entry.locale !== config.referenceLocale) continue;
            const files = parsedMap.get(`${entry.pack}:${entry.locale}`) ?? [];
            for (const file of files) {
                refFilesList.push(file);
                for (const line of file.lines) {
                    if (line.type === 'entry') refKeyMap.set(line.key, line.value);
                }
            }
        }

        const nonRefLocales = [...new Set(localeEntries.map((e) => e.locale))].filter(
            (l) => l !== config.referenceLocale,
        );
        const coverages: LocaleCoverage[] = [];

        for (const locale of nonRefLocales) {
            const targetKeyMap = new Map<string, string>();
            for (const entry of localeEntries) {
                if (entry.locale !== locale) continue;
                const km = keyMaps.get(`${entry.pack}:${locale}`);
                if (km) for (const [k, v] of km) targetKeyMap.set(k, v);
            }

            const cov = computeCoverage(refKeyMap, refFilesList, targetKeyMap, locale, excluded);
            coverages.push(cov);
        }

        const refTotal = refKeyMap.size - [...refKeyMap.keys()].filter((k) => excluded.has(k)).length;

        if (config.coverage) {
            console.info(``);
            console.info(`   ---------: Coverage...`);
            console.info(`   Reference: ${config.referenceLocale} (${refTotal} keys)`);

            for (const cov of coverages) {
                const pct =
                    refTotal > 0
                        ? ((cov.translated / refTotal) * 100).toFixed(1)
                        : '0.0';
                console.info(
                    `   ${cov.locale.padEnd(8)} ${cov.translated}/${refTotal} translated (${pct}%)` +
                        `   - ${cov.missing} missing, ${cov.untranslated} untranslated, ${cov.stale} stale`,
                );
            }

            if (coverages.length > 0) {
                const md = generateReport(coverages, config.referenceLocale, refTotal);
                const reportPath = await writeReport(md, rootDir);
                console.info(`   Wrote coverage report: ${reportPath}`);
            }
        }

        if (config.errorOnMissingTranslations && coverages.some((c) => c.missing > 0)) {
            fail('Some locales are missing translations (errorOnMissingTranslations is enabled)');
        }
    }

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.info(``);
    console.info(`   ---------: Results...`);
    console.info(`   Total files merged: ${totalFiles}`);
    console.info(`   Total lines merged: ${totalLines}`);
    console.info(`   Done in ${elapsed}s`);
}
