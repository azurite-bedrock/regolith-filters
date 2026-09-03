import JSON5 from 'json5';
import { extname } from '@std/path';

export type ParsedLine =
    | { type: 'entry'; key: string; value: string }
    | { type: 'comment'; text: string }
    | { type: 'blank' };

export interface ParsedFile {
    path: string;
    lines: ParsedLine[];
}

export function parseLang(text: string, path: string): ParsedFile {
    const lines: ParsedLine[] = [];
    const seen = new Set<string>();

    for (const raw of text.split('\n')) {
        const line = raw.replace(/\r$/, '');

        if (line.startsWith('##')) {
            lines.push({ type: 'comment', text: line });
            continue;
        }

        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) {
            lines.push({ type: 'blank' });
            continue;
        }

        const key = line.slice(0, eqIdx);
        const value = line.slice(eqIdx + 1);

        if (seen.has(key)) {
            throw new Error(`Duplicate key "${key}" in ${path}`);
        }
        seen.add(key);
        lines.push({ type: 'entry', key, value });
    }

    return { path, lines };
}

function objectToLines(obj: Record<string, unknown>, path: string): ParsedLine[] {
    const lines: ParsedLine[] = [];
    for (const [key, val] of Object.entries(obj)) {
        if (typeof val !== 'string') {
            throw new Error(
                `${path}: value for key "${key}" must be a string, got ${typeof val}`,
            );
        }
        lines.push({ type: 'entry', key, value: val });
    }
    return lines;
}

export function parseJson(text: string, path: string): ParsedFile {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (e) {
        throw new Error(`Failed to parse JSON in ${path}: ${(e as Error).message}`);
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error(`${path}: must be a flat JSON object`);
    }
    return { path, lines: objectToLines(raw as Record<string, unknown>, path) };
}

export function parseJson5(text: string, path: string): ParsedFile {
    let raw: unknown;
    try {
        raw = JSON5.parse(text);
    } catch (e) {
        throw new Error(`Failed to parse JSON5 in ${path}: ${(e as Error).message}`);
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error(`${path}: must be a flat JSON5 object`);
    }
    return { path, lines: objectToLines(raw as Record<string, unknown>, path) };
}

export async function parseFile(absPath: string, relPath: string): Promise<ParsedFile> {
    const text = await Deno.readTextFile(absPath);
    const ext = extname(absPath).toLowerCase();
    switch (ext) {
        case '.lang':
            return parseLang(text, relPath);
        case '.json':
            return parseJson(text, relPath);
        case '.json5':
            return parseJson5(text, relPath);
        default:
            throw new Error(`Unsupported file extension "${ext}" for ${absPath}`);
    }
}
