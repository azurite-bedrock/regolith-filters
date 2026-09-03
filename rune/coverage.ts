import type { ParsedFile } from './parse.ts';

export interface FileCoverage {
    path: string;
    total: number;
    translated: number;
    untranslated: number;
    missing: number;
}

export interface LocaleCoverage {
    locale: string;
    total: number;
    translated: number;
    untranslated: number;
    missing: number;
    stale: number;
    files: FileCoverage[];
}

export function computeCoverage(
    refKeyMap: Map<string, string>,
    refFiles: ParsedFile[],
    targetKeyMap: Map<string, string>,
    locale: string,
    excluded: Set<string> = new Set(),
): LocaleCoverage {
    let translated = 0;
    let untranslated = 0;
    let missing = 0;

    const fileCoverages: FileCoverage[] = [];

    for (const refFile of refFiles) {
        let fileTranslated = 0;
        let fileUntranslated = 0;
        let fileMissing = 0;

        for (const line of refFile.lines) {
            if (line.type !== 'entry') continue;
            if (excluded.has(line.key)) continue;
            if (!targetKeyMap.has(line.key)) {
                fileMissing++;
                missing++;
            } else if (targetKeyMap.get(line.key) === line.value) {
                fileUntranslated++;
                untranslated++;
            } else {
                fileTranslated++;
                translated++;
            }
        }

        const total = fileTranslated + fileUntranslated + fileMissing;
        fileCoverages.push({
            path: refFile.path,
            total,
            translated: fileTranslated,
            untranslated: fileUntranslated,
            missing: fileMissing,
        });
    }

    let stale = 0;
    for (const key of targetKeyMap.keys()) {
        if (!refKeyMap.has(key)) stale++;
    }

    let total = 0;
    for (const key of refKeyMap.keys()) {
        if (!excluded.has(key)) total++;
    }

    return {
        locale,
        total,
        translated,
        untranslated,
        missing,
        stale,
        files: fileCoverages,
    };
}
