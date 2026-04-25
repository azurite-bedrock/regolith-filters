import * as jsonc from 'jsonc-parser';

export interface ProcessOptions {
    removeComments?: boolean;
    removeTrailingCommas?: boolean;
    minify?: boolean;
    tabSize?: number;
}

/**
 * Process a raw JSON/JSONC string: optionally strip comments, then either
 * minify (compact, no whitespace) or pretty-print with the given tabSize.
 *
 * Non-minified output uses text-level operations only — number representations
 * like 0.0 and 1e2 are preserved as-is.
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
        const errors: jsonc.ParseError[] = [];
        const value = jsonc.parse(text, errors, { allowTrailingComma: true });
        if (errors.length > 0) {
            throw new Error(
                `JSON parse error at offsets: ${errors.map((e) => e.offset).join(', ')}`,
            );
        }
        return JSON.stringify(value);
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
