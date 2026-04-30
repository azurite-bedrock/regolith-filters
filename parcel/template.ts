import type { GitInfo } from './git.ts';

export type { GitInfo };

export interface TemplateContext {
    config: Record<string, unknown>;
    git: GitInfo;
}

export function resolveTemplate(template: string, context: TemplateContext): string {
    const { config, git } = context;
    try {
        // deno-lint-ignore no-eval
        // The `output` template is trusted filter settings (regolith config), not user data.
        return eval('`' + template + '`') as string;
    } catch (e) {
        throw new Error(
            `Failed to resolve "output" template "${template}": ${e instanceof Error ? e.message : String(e)}`,
        );
    }
}
