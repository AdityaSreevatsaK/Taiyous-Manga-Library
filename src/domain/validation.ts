import type { ChapterManifest, MangaChapter, MangaEntry, MangaPage, MangaProgress, SourceRights } from './types';

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
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max)
    throw new DomainValidationError(field, 'invalid integer');
  return value as number;
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
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(result) || !Number.isFinite(Date.parse(result)))
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
  const volume = optionalText(item.volume, 'chapter.volume', 60);
  const pageCount = optionalInteger(item.pageCount, 'chapter.pageCount', 0, 1000);
  if (volume !== undefined) chapter.volume = volume;
  if (pageCount !== undefined) chapter.pageCount = pageCount;
  return chapter;
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
  const synopsis = optionalText(item.synopsis, 'entry.synopsis', 2000);
  const rating = optionalInteger(item.rating, 'entry.rating', 1, 10);
  if (synopsis !== undefined) result.synopsis = synopsis;
  if (rating !== undefined) result.rating = rating;
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
  return {
    mangaId, chapterId,
    pageIndex: integer(item.pageIndex, 'progress.pageIndex', 0, manifest.pages.length - 1),
    updatedAt: timestamp(item.updatedAt, 'progress.updatedAt'),
  };
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
