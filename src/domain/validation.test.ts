import { describe, expect, it } from 'vitest';
import { parseCatalogue, parseChapterManifest, parseMangaEntry, parseProgress, parseSourceRights, validateArchiveIndex, validateAssetPath } from './validation';

const entry = {
  kind: 'manga', id: 'mng_example001', title: 'Example',
  aliases: [], creators: [], tags: [], publicationStatus: 'completed', direction: 'rtl',
  chapters: [{ id: 'ch_example001', label: 'First', sequence: 0, pageCount: 2 }],
};
const manifest = {
  schemaVersion: 1, mediaKind: 'manga', chapterId: 'ch_example001',
  pages: [0, 1].map(i => ({
    id: 'pg_example00' + i, assetPath: 'manga/example/chapter/page' + i + '.png',
    mimeType: 'image/png', width: 800, height: 1200, byteSize: 1000,
  })),
};
describe('runtime media schemas', () => {
  it('accepts and copies valid manga and manifest', () => {
    expect(parseMangaEntry(entry).chapters[0]?.id).toBe('ch_example001');
    expect(parseChapterManifest(manifest).pages).toHaveLength(2);
  });
  it('accepts optional accurate credits and a verified private cover without changing chapter IDs',()=>{
    const withMetadata={...entry,authors:['Example Writer'],artists:['Example Illustrator'],
      synopsis:'A verified story description.',tags:['Romance'],aliases:['Another title'],
      coverAsset:{assetPath:'covers/mng_example001.webp',mimeType:'image/webp',
        byteSize:1234,sha256:'a'.repeat(64)}};
    const result=parseMangaEntry(withMetadata);
    expect(result.authors).toEqual(['Example Writer']);
    expect(result.artists).toEqual(['Example Illustrator']);
    expect(result.coverAsset?.assetPath).toBe('covers/mng_example001.webp');
    expect(result.chapters[0]?.id).toBe(entry.chapters[0]?.id);
    expect(parseMangaEntry(entry).coverAsset).toBeUndefined();
  });
  it('rejects forged cover URLs, path traversal, bad hashes and mismatched MIME',()=>{
    const base={assetPath:'covers/mng_example001.webp',mimeType:'image/webp',
      byteSize:1234,sha256:'a'.repeat(64)};
    for(const cover of [
      {...base,assetPath:'https://huggingface.co/secret'},
      {...base,assetPath:'covers/mng_another000.webp'},
      {...base,assetPath:'../private.webp'},
      {...base,mimeType:'image/svg+xml'},
      {...base,byteSize:10_000_000},
      {...base,sha256:'invalid'},
    ])expect(()=>parseMangaEntry({...entry,coverAsset:cover})).toThrow();
  });
  it('rejects duplicate immutable IDs and ordering conflicts', () => {
    expect(() => parseCatalogue([entry, entry])).toThrow(/duplicate/);
    expect(() => parseMangaEntry({ ...entry, chapters: [entry.chapters[0], entry.chapters[0]] })).toThrow(/duplicate/);
    expect(() => parseMangaEntry({ ...entry, id: 'changed title as id' })).toThrow();
  });
  it('rejects unsafe asset filenames, URLs and script-bearing images', () => {
    for (const path of ['../private.png', 'manga/../page.png', 'https://example.com/1.png',
      '/manga/a/b.png', 'manga/a/b/x.svg', 'manga/a/b/%2e%2e.png', 'manga\\a\\b\\c.png', 'manga/a/b/x.png?token=secret']) {
      expect(() => validateAssetPath(path)).toThrow();
    }
    expect(() => parseChapterManifest({ ...manifest, pages: [{ ...manifest.pages[0], mimeType: 'image/svg+xml' }] })).toThrow();
    expect(() => parseChapterManifest({ ...manifest, pages: [manifest.pages[0], manifest.pages[0]] })).toThrow(/duplicate/);
    expect(() => parseChapterManifest({ ...manifest, pages: [
      manifest.pages[0], { ...manifest.pages[1], assetPath: manifest.pages[0]!.assetPath },
    ] })).toThrow(/duplicate/);
    expect(() => parseChapterManifest({ ...manifest, schemaVersion: 9 })).toThrow(/version/);
    expect(() => parseChapterManifest({ ...manifest, pages: [{ ...manifest.pages[0], width: 15000, height: 15000 }] })).toThrow(/pixel/);
  });
  it('rejects stale/out-of-bounds progress instead of silently clamping it', () => {
    const manga = parseMangaEntry(entry);
    const manifests = new Map([['ch_example001', parseChapterManifest(manifest)]]);
    expect(parseProgress({ mangaId: manga.id, chapterId: 'ch_example001', pageIndex: 0, pageId: 'pg_example000', updatedAt: '2026-11-18T00:00:00Z' }, manga, manifests).pageIndex).toBe(0);
    expect(() => parseProgress({ mangaId: manga.id, chapterId: 'ch_example001', pageIndex: 0, updatedAt: '2026-11-18T00:00:00Z' }, manga, manifests)).toThrow(/pageId/);
    expect(() => parseProgress({ mangaId: manga.id, chapterId: 'ch_example001', pageIndex: 0, pageId: 'pg_example001', updatedAt: '2026-11-18T00:00:00Z' }, manga, manifests)).toThrow(/pageId/);
    expect(() => parseProgress({ mangaId: manga.id, chapterId: 'ch_example001', pageIndex: 2, updatedAt: '2026-11-18T00:00:00Z' }, manga, manifests)).toThrow();
    expect(() => parseProgress({ mangaId: manga.id, chapterId: 'ch_elsewhere0', pageIndex: 0, updatedAt: '2026-11-18T00:00:00Z' }, manga, manifests)).toThrow();
  });
  it('rejects archive traversal, symlinks, bombs and duplicate pages', () => {
    const safe = { path: 'chapter001/page001.png', compressedSize: 100, uncompressedSize: 150, kind: 'file' };
    expect(validateArchiveIndex([safe])).toHaveLength(1);
    for (const bad of [
      { ...safe, path: 'chapter001/../private.png' },
      { ...safe, path: 'chapter001/page.svg' },
      { ...safe, kind: 'symlink' },
      { ...safe, uncompressedSize: 20000 },
    ]) expect(() => validateArchiveIndex([bad])).toThrow();
    expect(() => validateArchiveIndex([safe, safe])).toThrow(/duplicate/);
  });
  it('requires explicit proof of media rights', () => {
    expect(() => parseSourceRights({schemaVersion:1,sourceType:'licensed',title:'X', permissionEvidence:'',attribution:'Y',recordedAt:'2026-11-18T00:00:00Z'})).toThrow();
  });
});
