import type { ChapterManifest, MangaChapter, MangaEntry, MangaPage, MangaProgress, SourceRights, MangaCover, MangaCreatorRole, MangaMetadataSources, MangaPublicationField } from './types';

/** Runtime validation at trust boundaries, not just TypeScript assertions. */
export class DomainValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(field + ': ' + message);
    this.name = 'DomainValidationError';
  }
}
type UnknownRecord = Record<string, unknown>;
function record(value: unknown, field: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainValidationError(field, 'expected object');
  return value as UnknownRecord;
}
function literal<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new DomainValidationError(field, 'unsupported value');
  return value as T;
}
function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value))
    throw new DomainValidationError(field, 'expected safe non-empty text');
  return value.trim();
}
function list(value: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new DomainValidationError(field, 'invalid array');
  return value;
}
function textList(value: unknown, field: string, maxItems: number): string[] {
  const values = list(value, field, maxItems).map((item, i) => text(item, field + '[' + i + ']', 120));
  if (new Set(values.map(item => item.toLocaleLowerCase())).size !== values.length)
    throw new DomainValidationError(field, 'duplicate values');
  return values;
}
function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    throw new DomainValidationError(field, 'invalid integer');
  return value;
}
const idPattern = /^(?:mng|ch|pg)_[a-zA-Z0-9_-]{8,64}$/;
function id(value: unknown, field: string, prefix: 'mng' | 'ch' | 'pg'): string {
  if (typeof value !== 'string' || !idPattern.test(value) || !value.startsWith(prefix + '_'))
    throw new DomainValidationError(field, 'expected opaque ' + prefix + ' ID');
  return value;
}
function optionalText(value: unknown, field: string, max: number): string | undefined {
  return value === undefined ? undefined : text(value, field, max);
}
function optionalInteger(value: unknown, field: string, min: number, max: number): number | undefined {
  return value === undefined ? undefined : integer(value, field, min, max);
}
function unique(values: string[], field: string) {
  if (new Set(values).size !== values.length) throw new DomainValidationError(field, 'duplicate IDs');
}
function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(result) || (!Number.isFinite(Date.parse(result)) || new Date(Date.parse(result)).toISOString().slice(0, 10) !== result.slice(0, 10)))
    throw new DomainValidationError(field, 'expected UTC ISO timestamp');
  return result;
}
export function parseMangaChapter(value: unknown): MangaChapter {
  const item = record(value, 'chapter');
  const chapter: MangaChapter = {
    id: id(item.id, 'chapter.id', 'ch'),
    label: text(item.label, 'chapter.label', 120),
    sequence: integer(item.sequence, 'chapter.sequence', 0, 1000000),
  };
  const chapterSlug=optionalText(item.slug,'chapter.slug',100);
  if(chapterSlug!==undefined){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(chapterSlug))throw new DomainValidationError('chapter.slug','invalid slug');
    chapter.slug=chapterSlug;
  }
  const volume = optionalText(item.volume, 'chapter.volume', 60);
  const pageCount = optionalInteger(item.pageCount, 'chapter.pageCount', 0, 1000);
  if (volume !== undefined) chapter.volume = volume;
  if (pageCount !== undefined) chapter.pageCount = pageCount;
  return chapter;
}
/** Controller-managed artwork: data/covers/<manga-id>.<source-extension>. */
export function parseMangaCover(value: unknown, mangaId: string): MangaCover {
  const cover = record(value, 'entry.cover');
  if (Object.keys(cover).sort().join(',') !==
    'assetPath,byteSize,height,mimeType,sha256,width')
    throw new DomainValidationError('entry.cover', 'unexpected cover descriptor');
  const pattern = new RegExp('^covers/' + mangaId + '\\.(png|jpg|jpeg|webp|avif)$');
  const path = cover.assetPath;
  if (typeof path !== 'string' || !pattern.test(path))
    throw new DomainValidationError('entry.cover.assetPath', 'cover does not belong to manga');
  const suffix = path.split('.').at(-1)!;
  const expectedMime = suffix === 'jpg' || suffix === 'jpeg' ? 'image/jpeg' : 'image/' + suffix;
  if (cover.mimeType !== expectedMime)
    throw new DomainValidationError('entry.cover.mimeType', 'cover format mismatch');
  if (typeof cover.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(cover.sha256))
    throw new DomainValidationError('entry.cover.sha256', 'expected lowercase SHA-256');
  const width = integer(cover.width, 'entry.cover.width', 1, 16000);
  const height = integer(cover.height, 'entry.cover.height', 1, 16000);
  if (width * height > 70_000_000)
    throw new DomainValidationError('entry.cover.dimensions', 'pixel budget exceeded');
  return {assetPath:path,mimeType:expectedMime as MangaCover['mimeType'],width,height,
    byteSize:integer(cover.byteSize,'entry.cover.byteSize',1,5_000_000),sha256:cover.sha256};
}
function parseCreatorRoles(value: unknown): MangaCreatorRole[] {
  const roles = list(value,'entry.creatorRoles',24).map((item,index):MangaCreatorRole=>{
    const part=record(item,'entry.creatorRoles['+index+']');
    if(Object.keys(part).sort().join(',')!=='name,role')
      throw new DomainValidationError('entry.creatorRoles','unexpected creator role');
    return {name:text(part.name,'entry.creatorRoles.name',120),
      role:literal(part.role,['author','artist'] as const,'entry.creatorRoles.role')};
  });
  const identifiers=roles.map(r=>r.name.toLocaleLowerCase()+'|'+r.role);
  unique(identifiers,'entry.creatorRoles');
  return roles;
}
const METADATA_FIELDS = ['aliases','creators','creatorRoles','tags',
  'synopsis','publicationStatus','cover'] as const;
function parseMetadataSource(value: unknown) {
  const part=record(value,'entry.metadataSources.source');
  if(Object.keys(part).sort().join(',')!=='provider,retrievedAt,sourceId,sourceUrl')
    throw new DomainValidationError('entry.metadataSources','unexpected source fields');
  const provider=text(part.provider,'entry.metadataSources.provider',60);
  if(!/^[A-Za-z0-9_-]{2,60}$/.test(provider))
    throw new DomainValidationError('entry.metadataSources.provider','invalid provider');
  const sourceId=text(part.sourceId,'entry.metadataSources.sourceId',180);
  const sourceUrl=text(part.sourceUrl,'entry.metadataSources.sourceUrl',500);
  let url:URL;
  try{url=new URL(sourceUrl);}catch{
    throw new DomainValidationError('entry.metadataSources.sourceUrl','invalid HTTPS provenance');
  }
  if(url.protocol!=='https:'||!url.hostname.includes('.')||url.username||url.password
      ||url.search||url.hash||!(url.port===''||url.port==='443'))
    throw new DomainValidationError('entry.metadataSources.sourceUrl','unsafe source URL');
  const retrievedAt=text(part.retrievedAt,'entry.metadataSources.retrievedAt',40);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(retrievedAt)||
      !Number.isFinite(Date.parse(retrievedAt))||
      new Date(retrievedAt).toISOString().replace('.000','')!==retrievedAt)
    throw new DomainValidationError('entry.metadataSources.retrievedAt','invalid UTC timestamp');
  return {provider,sourceId,sourceUrl,retrievedAt};
}
function parseMetadataSources(value: unknown,entry:Record<string,unknown>):MangaMetadataSources {
  const sources=record(value,'entry.metadataSources');
  const checked:MangaMetadataSources={};
  for(const [key,origin] of Object.entries(sources)){
    if(!(METADATA_FIELDS as readonly string[]).includes(key)||!(key in entry))
      throw new DomainValidationError('entry.metadataSources','unknown or absent publication field');
    checked[key as MangaPublicationField]=parseMetadataSource(origin);
  }
  return checked;
}
export function parseMangaEntry(value: unknown): MangaEntry {
  const item = record(value, 'entry');
  const chapters = list(item.chapters, 'entry.chapters', 2000).map(parseMangaChapter);
  unique(chapters.map(chapter => chapter.id), 'entry.chapters');
  unique(chapters.map(chapter => String(chapter.sequence)), 'entry.chapters.sequence');
  const result: MangaEntry = {
    kind: literal(item.kind, ['manga'], 'entry.kind'),
    id: id(item.id, 'entry.id', 'mng'),
    title: text(item.title, 'entry.title', 180),
    aliases: textList(item.aliases, 'entry.aliases', 24),
    creators: textList(item.creators, 'entry.creators', 24),
    tags: textList(item.tags, 'entry.tags', 32),
    publicationStatus: literal(item.publicationStatus, ['unknown', 'ongoing', 'completed', 'hiatus'], 'entry.publicationStatus'),
    direction: literal(item.direction, ['rtl', 'ltr', 'vertical'], 'entry.direction'),
    chapters,
  };
  const entrySlug=optionalText(item.slug,'entry.slug',100);
  if(entrySlug!==undefined){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entrySlug))throw new DomainValidationError('entry.slug','invalid slug');
    result.slug=entrySlug;
  }
  const synopsis = optionalText(item.synopsis, 'entry.synopsis', 2000);
  const rating = optionalInteger(item.rating, 'entry.rating', 1, 10);
  if (synopsis !== undefined) result.synopsis = synopsis;
  if (rating !== undefined) result.rating = rating;
  if(item.creatorRoles!==undefined)result.creatorRoles=parseCreatorRoles(item.creatorRoles);
  if(item.cover!==undefined)result.cover=parseMangaCover(item.cover,result.id);
  if(item.metadataSources!==undefined)result.metadataSources=parseMetadataSources(item.metadataSources,item);
  if (item.collections !== undefined) result.collections = textList(item.collections, 'entry.collections', 32);
  return result;
}
export function parseCatalogue(value: unknown): MangaEntry[] {
  const items = list(value, 'catalogue', 10000).map(parseMangaEntry);
  unique(items.map(item => item.id), 'catalogue');
  const chapterIds = items.flatMap(item => item.chapters.map(chapter => chapter.id));
  unique(chapterIds, 'catalogue.chapterIds');
  return items;
}
/** Enforces a non-URL, single rooted private-media path. No encoded or nested traversal. */
export function validateAssetPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 240 || !/^manga\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(?:png|jpg|jpeg|webp|avif)$/.test(value))
    throw new DomainValidationError('page.assetPath', 'invalid private relative asset path');
  return value;
}
export function parseChapterManifest(value: unknown): ChapterManifest {
  const item = record(value, 'manifest');
  if (item.schemaVersion !== 1) throw new DomainValidationError('manifest.schemaVersion', 'unsupported version');
  const chapterId = id(item.chapterId, 'manifest.chapterId', 'ch');
  const pages = list(item.pages, 'manifest.pages', 1000).map((value, index): MangaPage => {
    const p = record(value, 'page[' + index + ']');
    const mimeType = literal(p.mimeType, ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], 'page.mimeType');
    const assetPath = validateAssetPath(p.assetPath);
    const extension = assetPath.split('.').at(-1);
    if (!(mimeType === 'image/jpeg' ? ['jpg', 'jpeg'].includes(extension ?? '') :
      extension === mimeType.split('/')[1]))
      throw new DomainValidationError('page.mimeType', 'does not match file extension');
    const result: MangaPage = {
      id: id(p.id, 'page.id', 'pg'),
      assetPath, mimeType,
      width: integer(p.width, 'page.width', 1, 16000),
      height: integer(p.height, 'page.height', 1, 16000),
      byteSize: integer(p.byteSize, 'page.byteSize', 1, 25000000),
    };
    if (result.width * result.height > 70000000)
      throw new DomainValidationError('page.dimensions', 'pixel budget exceeded');
    if (p.sha256 !== undefined) {
      if (typeof p.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(p.sha256))
        throw new DomainValidationError('page.sha256', 'expected lowercase SHA-256');
      result.sha256 = p.sha256;
    }
    return result;
  });
  if (pages.length === 0) throw new DomainValidationError('manifest.pages', 'empty chapter');
  unique(pages.map(page => page.id), 'manifest.pages');
  unique(pages.map(page => page.assetPath), 'manifest.assetPaths');
  return {
    schemaVersion: 1,
    mediaKind: literal(item.mediaKind, ['manga'], 'manifest.mediaKind'),
    chapterId, pages,
  };
}
export function parseProgress(value: unknown, entry: MangaEntry, manifests: ReadonlyMap<string, ChapterManifest>): MangaProgress {
  const item = record(value, 'progress');
  const mangaId = id(item.mangaId, 'progress.mangaId', 'mng');
  const chapterId = id(item.chapterId, 'progress.chapterId', 'ch');
  if (mangaId !== entry.id || !entry.chapters.some(chapter => chapter.id === chapterId))
    throw new DomainValidationError('progress.chapterId', 'does not belong to series');
  const manifest = manifests.get(chapterId);
  if (!manifest) throw new DomainValidationError('progress.chapterId', 'manifest unavailable');
  if (manifest.chapterId !== chapterId) throw new DomainValidationError('progress.chapterId', 'manifest identity mismatch');
  const pageIndex = integer(item.pageIndex, 'progress.pageIndex', 0, manifest.pages.length - 1);
  const pageId = id(item.pageId, 'progress.pageId', 'pg');
  if (manifest.pages[pageIndex]?.id !== pageId)
    throw new DomainValidationError('progress.pageId', 'manifest page identity changed; reconcile before resuming');
  const result: MangaProgress = {
    mangaId, chapterId, pageIndex, pageId,
    updatedAt: timestamp(item.updatedAt, 'progress.updatedAt'),
  };
  if (item.readingMode !== undefined)
    result.readingMode = literal(item.readingMode, ['rtl', 'ltr', 'vertical'] as const, 'progress.readingMode');
  if (item.verticalOffsetRatio !== undefined) {
    const ratio = item.verticalOffsetRatio;
    if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio < 0 || ratio > 1)
      throw new DomainValidationError('progress.verticalOffsetRatio', 'expected fraction 0 to 1');
    result.verticalOffsetRatio = ratio;
  }
  return result;
}
export interface ArchiveEntry {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
  kind: 'file' | 'directory' | 'symlink';
}
/** Preflight ZIP central-directory metadata. It does not extract archives. */
export function validateArchiveIndex(input: unknown): ArchiveEntry[] {
  const entries = list(input, 'archive.entries', 1000).map((value, index): ArchiveEntry => {
    const item = record(value, 'archive.entries[' + index + ']');
    if (item.kind !== 'file') throw new DomainValidationError('archive.entry.kind', 'only regular image files allowed');
    if (typeof item.path !== 'string' || item.path.length > 180 ||
      !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(?:png|jpg|jpeg|webp|avif)$/.test(item.path))
      throw new DomainValidationError('archive.entry.path', 'unsafe image member path');
    const compressedSize = integer(item.compressedSize, 'archive.entry.compressedSize', 1, 25000000);
    const uncompressedSize = integer(item.uncompressedSize, 'archive.entry.uncompressedSize', 1, 25000000);
    if (uncompressedSize > compressedSize * 100)
      throw new DomainValidationError('archive.entry.ratio', 'suspicious compression ratio');
    return { path: item.path, compressedSize, uncompressedSize, kind: 'file' };
  });
  unique(entries.map(entry => entry.path), 'archive.entries');
  if (entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0) > 500000000)
    throw new DomainValidationError('archive.totalSize', 'archive exceeds 500 MB');
  return entries;
}
export function parseSourceRights(value: unknown): SourceRights {
  const item = record(value, 'rights');
  if (item.schemaVersion !== 1) throw new DomainValidationError('rights.schemaVersion', 'unsupported version');
  return {
    schemaVersion: 1,
    sourceType: literal(item.sourceType, ['original', 'owned', 'licensed'], 'rights.sourceType'),
    title: text(item.title, 'rights.title', 180),
    permissionEvidence: text(item.permissionEvidence, 'rights.permissionEvidence', 400),
    attribution: text(item.attribution, 'rights.attribution', 400),
    recordedAt: timestamp(item.recordedAt, 'rights.recordedAt'),
  };
}
