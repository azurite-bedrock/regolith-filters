export type ContentType =
    | 'addon'
    | 'world'
    | 'world_template'
    | 'resource_pack'
    | 'behavior_pack'
    | 'skin_pack'
    | 'editor_addon';

export interface Config {
    content_type: ContentType;
    output: string;
    bp: string;
    rp: string;
    world: string;
    skin_pack: string;
    compression_level: number;
    stored_extensions: string[];
    update_version_from_tag: boolean;
}

export const CONTENT_TYPES: ContentType[] = [
    'addon',
    'world',
    'world_template',
    'resource_pack',
    'behavior_pack',
    'skin_pack',
    'editor_addon',
];

export const DEFAULT_STORED_EXTENSIONS: string[] = [
    '.png',
    '.jpg',
    '.jpeg',
    '.ogg',
    '.fsb',
    '.zip',
    '.mcpack',
    '.mcaddon',
    '.mcworld',
    '.mctemplate',
    '.mceditoraddon',
];

export function parseConfig(raw: string): Config {
    if (!raw || raw.trim() === '') {
        throw new Error('Filter settings must be provided.');
    }
    let s: Record<string, unknown>;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error();
        }
        s = parsed as Record<string, unknown>;
    } catch {
        throw new Error('Filter settings must be a valid JSON object.');
    }

    if (typeof s.content_type !== 'string') {
        throw new Error('"content_type" must be a string.');
    }
    if (!CONTENT_TYPES.includes(s.content_type as ContentType)) {
        throw new Error(`"content_type" must be one of: ${CONTENT_TYPES.join(', ')}.`);
    }

    if (typeof s.output !== 'string' || s.output.trim() === '') {
        throw new Error('"output" must be a non-empty string.');
    }

    let compression_level = 6;
    if (s.compression_level !== undefined) {
        if (typeof s.compression_level !== 'number' || !Number.isInteger(s.compression_level)) {
            throw new Error('"compression_level" must be an integer.');
        }
        if (s.compression_level < 0 || s.compression_level > 9) {
            throw new Error('"compression_level" must be between 0 and 9.');
        }
        compression_level = s.compression_level as number;
    }

    let stored_extensions = [...DEFAULT_STORED_EXTENSIONS];
    if (s.stored_extensions !== undefined) {
        if (
            !Array.isArray(s.stored_extensions) ||
            !s.stored_extensions.every((e: unknown) => typeof e === 'string')
        ) {
            throw new Error('"stored_extensions" must be an array of strings.');
        }
        stored_extensions = s.stored_extensions as string[];
    }

    let update_version_from_tag = false;
    if (s.update_version_from_tag !== undefined) {
        if (typeof s.update_version_from_tag !== 'boolean') {
            throw new Error('"update_version_from_tag" must be a boolean.');
        }
        update_version_from_tag = s.update_version_from_tag as boolean;
    }

    return {
        content_type: s.content_type as ContentType,
        output: (s.output as string).trim(),
        bp: typeof s.bp === 'string' ? s.bp : 'BP',
        rp: typeof s.rp === 'string' ? s.rp : 'RP',
        world: typeof s.world === 'string' ? s.world : 'World',
        skin_pack: typeof s.skin_pack === 'string' ? s.skin_pack : 'SkinPack',
        compression_level,
        stored_extensions,
        update_version_from_tag,
    };
}
