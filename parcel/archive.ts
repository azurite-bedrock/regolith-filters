import { Zip, AsyncZipDeflate, ZipPassThrough } from 'fflate';
import { extname, dirname } from '@std/path';

export type ZipEntry =
    | { zipPath: string; diskPath: string }
    | { zipPath: string; content: Uint8Array };

export function shouldStore(ext: string, storedExtensions: string[]): boolean {
    return storedExtensions.includes(ext.toLowerCase());
}

export async function buildZip(
    entries: ZipEntry[],
    outputPath: string,
    level: number,
    storedExtensions: string[],
): Promise<void> {
    await Deno.mkdir(dirname(outputPath), { recursive: true });
    const file = await Deno.open(outputPath, { write: true, create: true, truncate: true });

    try {
        await new Promise<void>((resolve, reject) => {
            let failed = false;
            const zip = new Zip((err, chunk, final) => {
                if (failed) return;
                if (err) {
                    failed = true;
                    reject(err);
                    return;
                }
                try {
                    file.writeSync(chunk);
                } catch (e) {
                    failed = true;
                    reject(e);
                    return;
                }
                if (final) resolve();
            });

            (async () => {
                for (const entry of entries) {
                    if (failed) break;
                    const data =
                        'diskPath' in entry
                            ? await Deno.readFile(entry.diskPath)
                            : entry.content;
                    const ext = extname(entry.zipPath);
                    const fileEntry = shouldStore(ext, storedExtensions)
                        ? new ZipPassThrough(entry.zipPath)
                        : new AsyncZipDeflate(entry.zipPath, {
                              level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
                          });
                    zip.add(fileEntry);
                    fileEntry.push(data, true);
                }
                if (!failed) zip.end();
            })().catch(reject);
        });
    } finally {
        file.close();
    }
}
