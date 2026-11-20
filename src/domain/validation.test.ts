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
  const provenance={provider:'mangadex',sourceId:'demo-series',
    sourceUrl:'https://mangadex.org/title/demo-series',retrievedAt:'2026-11-20T08:30:00Z'};
  const makeCover=(suffix='webp',mimeType='image/webp')=>({
    assetPath:'covers/mng_example001.'+suffix,mimeType,width:800,height:1200,
    byteSize:1234,sha256:'a'.repeat(64),
  });
  it('round-trips the Controller cover, creator roles and provenance without changing IDs',()=>{
    const enriched={...entry,creatorRoles:[
      {name:'Example Writer',role:'author'},{name:'Example Illustrator',role:'artist'}],
      creators:['Example Writer','Example Illustrator'],
      tags:['Romance'],aliases:['Alternative title'],synopsis:'Enriched synopsis',
      cover:makeCover(),metadataSources:{
        cover:provenance,creatorRoles:provenance,tags:provenance,synopsis:provenance,
      }};
    const result=parseMangaEntry(enriched);
    expect(result.cover).toEqual(makeCover());
    expect(result.creatorRoles).toEqual(enriched.creatorRoles);
    expect(result.metadataSources?.cover).toEqual(provenance);
    expect(result.chapters[0]?.id).toBe(entry.chapters[0]?.id);
    expect(parseMangaEntry(entry).cover).toBeUndefined();
    expect(parseMangaEntry(entry).creatorRoles).toBeUndefined();
  });
  it('accepts original PNG, JPEG (jpg/jpeg), WebP and AVIF covers without conversion',()=>{
    for(const [suffix,mime] of [
      ['png','image/png'],['jpg','image/jpeg'],['jpeg','image/jpeg'],
      ['webp','image/webp'],['avif','image/avif'],
    ]){
      const parsed=parseMangaEntry({...entry,cover:makeCover(suffix,mime)});
      expect(parsed.cover?.assetPath).toBe('covers/mng_example001.'+suffix);
      expect(parsed.cover?.mimeType).toBe(mime);
    }
  });
  it('rejects forged covers, traversal, mismatched sizes and MIME',()=>{
    const base=makeCover();
    for(const cover of [
      {...base,assetPath:'https://huggingface.co/secret'},
      {...base,assetPath:'covers/mng_another000.webp'},
      {...base,assetPath:'../private.webp'},
      {...base,mimeType:'image/jpeg'},
      {...base,byteSize:5_000_001},
      {...base,sha256:'invalid'},
      {...base,width:15000,height:15000},
      {...base,unexpected:true},
    ])expect(()=>parseMangaEntry({...entry,cover})).toThrow();
  });
  it('rejects malformed creator roles and untrusted provenance URLs',()=>{
    for(const creatorRoles of [
      [{name:'Someone',role:'editor'}],
      [{name:'Someone',role:'author'},{name:'someone',role:'author'}],
      [{name:'Someone',role:'author',url:'https://example.com'}],
    ])expect(()=>parseMangaEntry({...entry,creatorRoles})).toThrow();
    for(const sourceUrl of [
      'http://example.com/title/a',
      'https://example.com/title/a?token=secret',
      'https://account:token@example.com/title/a',
      'https://example.com/title/a#auth',
      'https://localhost/title/a',
    ])expect(()=>parseMangaEntry({...entry,metadataSources:{
      tags:{...provenance,sourceUrl},
    }})).toThrow();
    expect(()=>parseMangaEntry({...entry,metadataSources:{
      cover:provenance,
    }})).toThrow(/absent publication field/);
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
