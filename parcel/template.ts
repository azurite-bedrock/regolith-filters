import type { GitInfo } from './git.ts';

export type { GitInfo };

export interface TemplateContext {
    config: Record<string, unknown>;
    git: GitInfo;
}

export function resolveTemplate(template: string, context: TemplateContext): string {
    const { config, git } = context;
    try {
        // Create a function that accepts 'config' and 'git' as arguments
        // and returns the evaluated template string.
        const resolver = new Function('config', 'git', `return \`${template}\`;`);

        return resolver(config, git) as string;
    } catch (e) {
        throw new Error(
            `Failed to resolve "output" template "${template}": ${e instanceof Error ? e.message : String(e)}`,
        );
    }
}
