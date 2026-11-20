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
/** Draft cross-repository metadata contract. Controller confirmation required before merge. */
export interface MangaCoverAsset {
  /** Relative to the private HF dataset's data/ directory. Never a URL. */
  assetPath: string;
  mimeType: 'image/webp';
  byteSize: number;
  sha256: string;
}
export interface MangaEntry {
  kind: 'manga';
  id: string;
  title: string;
  aliases: string[];
  creators: string[];
  /** Structured credits are optional to preserve existing canonical entries. */
  authors?: string[];
  artists?: string[];
  tags: string[];
  publicationStatus: PublicationStatus;
  direction: ReadingDirection;
  chapters: MangaChapter[];
  synopsis?: string;
  /** Authenticated same-origin cover endpoint resolves and verifies this asset. */
  coverAsset?: MangaCoverAsset;
  /** Only synthetic fixture ratings may appear in this static demo bundle. */
  rating?: number;
  collections?: string[];
}
export interface MangaProgress {
  mangaId: string;
  chapterId: string;
  /** Zero-based; never use a chapter label or displayed page number as identity. */
  pageIndex: number;
  /** Immutable page ID prevents restoring to the wrong image if order changes. */
  pageId: string;
  updatedAt: string;
  /** Mode in which the page was last viewed. */
  readingMode?: ReadingDirection;
  /** Fractional anchor from 0 to 1 within a tall vertical image. */
  verticalOffsetRatio?: number;
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
