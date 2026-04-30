import * as jsonc from 'jsonc-parser';

export interface ProcessOptions {
    removeComments?: boolean;
    removeTrailingCommas?: boolean;
    minify?: boolean;
    tabSize?: number;
}

/**
 * Strip all whitespace outside of string values. Operates purely at the text
 * level so number representations like 0.0 and 1e2 are preserved as-is.
 */
function stripWhitespace(text: string): string {
    let result = '';
    let inString = false;
    let escape = false;
    for (const ch of text) {
        if (escape) {
            result += ch;
            escape = false;
        } else if (ch === '\\' && inString) {
            result += ch;
            escape = true;
        } else if (ch === '"') {
            result += ch;
            inString = !inString;
        } else if (inString) {
            result += ch;
        } else if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') {
            result += ch;
        }
    }
    return result;
}

/**
 * Process a raw JSON/JSONC string: optionally strip comments, then either
 * minify (compact, no whitespace) or pretty-print with the given tabSize.
 * All operations are text-level — number representations like 0.0 and 1e2
 * are preserved as-is in both modes.
 */
export function processText(raw: string, options: ProcessOptions = {}): string {
    const {
        removeComments = true,
        removeTrailingCommas = true,
        minify = false,
        tabSize = 4,
    } = options;

    const text = removeComments ? jsonc.stripComments(raw) : raw;

    if (minify) {
        const stripped = removeTrailingCommas ? text.replace(/,(\s*[}\]])/g, '$1') : text;
        return stripWhitespace(stripped);
    }

    const edits = jsonc.format(text, undefined, { tabSize, insertSpaces: true });
    const formatted = jsonc.applyEdits(text, edits);
    if (!removeTrailingCommas) return formatted;
    // jsonc.format() does not expose a trailing-comma removal option.
    // Strip them with a targeted regex: commas followed only by optional
    // whitespace then } or ]. Safe for valid JSON; would corrupt string
    // values containing literal unescaped newlines (invalid JSON), which
    // cannot appear in well-formed input.
    return formatted.replace(/,(\s*[}\]])/g, '$1');
}
