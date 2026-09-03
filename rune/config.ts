export interface Config {
    referenceLocale: string;
    enforceStructure: boolean;
    stripComments: boolean;
    randomizeEntries: boolean;
    errorOnMissingTranslations: boolean;
    coverage: boolean;
}

function fail(msg: string): never {
    throw new Error(msg);
}

export function parseConfig(raw: unknown): Config {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        fail('filter settings must be a JSON object');
    }
    const s = raw as Record<string, unknown>;
    if (typeof s.referenceLocale !== 'string' || s.referenceLocale === '') {
        fail('`referenceLocale` is required and must be a non-empty string');
    }
    return {
        referenceLocale: s.referenceLocale,
        enforceStructure: typeof s.enforceStructure === 'boolean' ? s.enforceStructure : true,
        stripComments: typeof s.stripComments === 'boolean' ? s.stripComments : false,
        randomizeEntries: typeof s.randomizeEntries === 'boolean' ? s.randomizeEntries : false,
        errorOnMissingTranslations:
            typeof s.errorOnMissingTranslations === 'boolean'
                ? s.errorOnMissingTranslations
                : false,
        coverage: typeof s.coverage === 'boolean' ? s.coverage : true,
    };
}
