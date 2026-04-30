export interface GitInfo {
    tag: string | null;
    commit: string | null;
    branch: string | null;
    tagCommit: string | null;
}

function runGit(args: string[]): string | null {
    try {
        const result = new Deno.Command('git', {
            args,
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

export function resolveGitInfo(): GitInfo {
    const tag = runGit(['describe', '--tags', '--abbrev=0']);
    const commit = runGit(['rev-parse', 'HEAD']);
    const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    const tagCommit = tag ? runGit(['rev-list', '-n', '1', tag]) : null;
    return { tag, commit, branch, tagCommit };
}
