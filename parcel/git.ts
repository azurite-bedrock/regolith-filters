export interface GitInfo {
    tag: string | null;
    commit: string | null;
    branch: string | null;
    tagCommit: string | null;
}

function runGit(args: string[], cwd: string): string | null {
    try {
        const result = new Deno.Command('git', {
            args,
            cwd,
            stdout: 'piped',
            stderr: 'null',
        }).outputSync();
        if (!result.success) return null;
        const text = new TextDecoder().decode(result.stdout).trim();
        return text || null;
    } catch {
        return null;
    }
}

export function resolveGitInfo(cwd: string): GitInfo {
    const tag = runGit(['describe', '--tags', '--abbrev=0'], cwd);
    const commit = runGit(['rev-parse', 'HEAD'], cwd);
    const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    const tagCommit = tag ? runGit(['rev-list', '-n', '1', tag], cwd) : null;
    return { tag, commit, branch, tagCommit };
}
