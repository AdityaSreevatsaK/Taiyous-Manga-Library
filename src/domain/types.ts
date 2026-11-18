/** Domain-specific opaque IDs. Display names and chapter labels are never keys. */
export type PublicationStatus = 'unknown' | 'ongoing' | 'completed' | 'hiatus';
export type ReadingDirection = 'rtl' | 'ltr' | 'vertical';
export interface MangaChapter {
  id: string;
  label: string;
  volume?: string;
  /** Immutable ordering key within its series; titles/labels can change. */
  sequence: number;
  /** Count is informational until matched against a validated manifest. */
  pageCount?: number;
}
export interface MangaEntry {
  kind: 'manga';
  id: string;
  title: string;
  aliases: string[];
  creators: string[];
  tags: string[];
  publicationStatus: PublicationStatus;
  direction: ReadingDirection;
  chapters: MangaChapter[];
  synopsis?: string;
  /** Only synthetic fixture ratings may appear in this static demo bundle. */
  rating?: number;
  collections?: string[];
}
export interface MangaProgress {
  mangaId: string;
  chapterId: string;
  /** Zero-based; never use a chapter label or displayed page number as identity. */
  pageIndex: number;
  updatedAt: string;
}
export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
export interface MangaPage {
  id: string;
  /** Never a URL. Runtime renders only trusted in-memory fixture pages. */
  assetPath: string;
  mimeType: ImageMime;
  width: number;
  height: number;
  byteSize: number;
  sha256?: string;
}
export interface ChapterManifest {
  schemaVersion: 1;
  mediaKind: 'manga';
  chapterId: string;
  pages: MangaPage[];
}
export interface SourceRights {
  schemaVersion: 1;
  sourceType: 'original' | 'owned' | 'licensed';
  title: string;
  permissionEvidence: string;
  attribution: string;
  recordedAt: string;
}
