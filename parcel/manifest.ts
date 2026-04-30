export type Version = [number, number, number];

export function patchManifestVersion(content: string, version: Version): string {
    const manifest = JSON.parse(content) as Record<string, unknown>;

    if (manifest.header && typeof manifest.header === 'object') {
        (manifest.header as Record<string, unknown>).version = [...version];
    }

    if (Array.isArray(manifest.dependencies)) {
        for (const dep of manifest.dependencies) {
            if (
                dep &&
                typeof dep === 'object' &&
                typeof (dep as Record<string, unknown>).uuid === 'string'
            ) {
                (dep as Record<string, unknown>).version = [...version];
            }
        }
    }

    return JSON.stringify(manifest, null, '\t');
}

export function parseVersionFromTag(tag: string): Version | null {
    const match = tag.match(/\d+(?:\.\d+)*/);
    if (!match) return null;

    const segments = match[0]
        .split('.')
        .map(Number)
        .filter((n) => Number.isFinite(n));

    if (segments.length === 0 || segments.length > 3) return null;

    while (segments.length < 3) segments.push(0);

    return [segments[0], segments[1], segments[2]];
}
