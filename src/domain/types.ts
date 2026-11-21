/** Domain-specific opaque IDs. Display names and chapter labels are never keys. */
export type PublicationStatus = 'unknown' | 'ongoing' | 'completed' | 'hiatus' | 'dropped';
export type ReadingDirection = 'rtl' | 'ltr' | 'vertical';
export interface MangaChapter {
  id: string;
  label: string;
  /** Persistent public chapter URL slug; immutable chapter ID remains primary. */
  slug?: string;
  volume?: string;
  /** Immutable ordering key within its series; titles/labels can change. */
  sequence: number;
  /** Count is informational until matched against a validated manifest. */
  pageCount?: number;
}
/** Canonical metadata fields agreed with the Manga Storage Controller draft contract. */
export interface MangaCover {
  /** Relative to data/ in the private Hugging Face dataset, never a URL. */
  assetPath: string;
  mimeType: ImageMime;
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
}
export interface MangaCreatorRole {
  name: string;
  role: 'author' | 'artist';
}
export type MangaPublicationField =
  | 'aliases' | 'creators' | 'creatorRoles' | 'tags'
  | 'synopsis' | 'publicationStatus' | 'cover';
export interface MangaMetadataSource {
  provider: string;
  sourceId: string;
  sourceUrl: string;
  retrievedAt: string;
}
export type MangaMetadataSources = Partial<Record<MangaPublicationField, MangaMetadataSource>>;
export interface MangaEntry {
  kind: 'manga';
  id: string;
  title: string;
  /** Persistent public manga URL slug; immutable manga ID remains primary. */
  slug?: string;
  aliases: string[];
  creators: string[];
  /** Structured role credits, retaining creators for older consumers. */
  creatorRoles?: MangaCreatorRole[];
  /** Field-level publication provenance, never personal annotations. */
  metadataSources?: MangaMetadataSources;
  tags: string[];
  publicationStatus: PublicationStatus;
  direction: ReadingDirection;
  chapters: MangaChapter[];
  synopsis?: string;
  /** Verified cover under data/covers, served only by the authenticated gateway. */
  cover?: MangaCover;
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
