export interface Config {
    removeComments: boolean;
    removeTrailingCommas: boolean;
    minify: boolean;
    jsonc: boolean;
    json5: boolean;
    batchSize: number;
    tabSize: number;
}

export const DEFAULTS: Config = {
    removeComments: true,
    removeTrailingCommas: true,
    minify: false,
    jsonc: true,
    json5: true,
    batchSize: 20,
    tabSize: 4,
};

export function parseConfig(arg: string | undefined): Config {
    try {
        if (!arg) throw new Error();
        return { ...DEFAULTS, ...(JSON.parse(arg) as Partial<Config>) };
    } catch {
        return { ...DEFAULTS };
    }
}
