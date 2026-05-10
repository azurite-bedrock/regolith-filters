export interface Config {
    root_dir: string;
    include: string[];
    exclude: string[];
    extra_vars: { [key: string]: string };
}

export const DEFAULTS: Config = {
    root_dir: './',
    include: ['data/marathon/**/*.ts', 'data/marathon/**/*.js'],
    exclude: ['data/**/*.ts', 'data/**/*.js'],
    extra_vars: {},
};

export function load_config(arg: string | undefined = Deno.args[0]): Config {
    try {
        if (!arg) throw new Error();
        return { ...DEFAULTS, ...(JSON.parse(arg) as Partial<Config>) };
    } catch {
        return { ...DEFAULTS };
    }
}
