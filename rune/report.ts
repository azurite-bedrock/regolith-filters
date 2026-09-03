import { join } from '@std/path';
import type { LocaleCoverage } from './coverage.ts';

export function generateReport(
    coverages: LocaleCoverage[],
    refLocale: string,
    refTotal: number,
): string {
    const lines: string[] = [];

    lines.push(`# Rune Coverage Report`);
    lines.push(``);
    lines.push(`Reference locale: \`${refLocale}\` (${refTotal} keys)`);
    lines.push(``);
    lines.push(`## Summary`);
    lines.push(``);
    lines.push(`| Language | Translated |    % | Missing | Untranslated | Stale |`);
    lines.push(`| -------- | ---------: | ---: | ------: | -----------: | ----: |`);

    const sorted = [...coverages].sort((a, b) => {
        const pctA = a.total > 0 ? a.translated / a.total : 0;
        const pctB = b.total > 0 ? b.translated / b.total : 0;
        return pctB - pctA;
    });

    for (const cov of sorted) {
        const pct =
            cov.total > 0 ? ((cov.translated / cov.total) * 100).toFixed(1) + '%' : '0.0%';
        lines.push(
            `| \`${cov.locale}\` | ${cov.translated}/${cov.total} | ${pct} | ${cov.missing} | ${cov.untranslated} | ${cov.stale} |`,
        );
    }

    lines.push(``);

    for (const cov of sorted) {
        const incomplete = cov.files.filter((f) => f.translated < f.total);
        if (incomplete.length === 0) continue;

        lines.push(`## \`${cov.locale}\` - per-file breakdown`);
        lines.push(``);
        lines.push(`| Source file | Translated |    % | Missing | Untranslated |`);
        lines.push(`| ----------- | ---------: | ---: | ------: | -----------: |`);

        for (const file of incomplete) {
            const pct =
                file.total > 0 ? ((file.translated / file.total) * 100).toFixed(1) + '%' : '0.0%';
            lines.push(
                `| \`${file.path}\` | ${file.translated}/${file.total} | ${pct} | ${file.missing} | ${file.untranslated} |`,
            );
        }

        lines.push(``);
    }

    return lines.join('\n');
}

export async function writeReport(content: string, rootDir: string): Promise<string> {
    const reportsDir = join(rootDir, 'reports');
    await Deno.mkdir(reportsDir, { recursive: true });
    const reportPath = join(reportsDir, 'rune_coverage_report.md');
    await Deno.writeTextFile(reportPath, content);
    return reportPath;
}
