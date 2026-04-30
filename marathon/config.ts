export interface Config {
    root_dir?: string;
    include?: string[];
    exclude?: string[];
}

export function load_config(): Config {
    try {
        const config = JSON.parse(Deno.args[0]) as Config;
        if (!config.root_dir) console.error('Settings object must contain a "root_dir"');
        if (!config.include)
            config.include = ['data/marathon/**/*.ts', 'data/marathon/**/*.js'];
        if (!config.exclude) config.exclude = ['data/**/*.ts', 'data/**/*.js'];
        return config;
    } catch {
        return {
            root_dir: './',
            include: ['data/marathon/**/*.ts', 'data/marathon/**/*.js'],
            exclude: ['data/**/*.ts', 'data/**/*.js'],
        };
    }
}
