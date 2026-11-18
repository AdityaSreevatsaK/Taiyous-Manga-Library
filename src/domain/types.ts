/** Manga domain model; local IDs are stable and must not be inferred from titles. */
export type PublicationStatus = 'unknown' | 'ongoing' | 'completed' | 'hiatus';
export type ReadingDirection = 'rtl' | 'ltr' | 'vertical';
export interface MangaChapter {
  id: string;
  /** Stable, human-readable label. Never use as an identifier. */
  label: string;
  volume?: string;
  sequence: number;
  /** Optional count only; a manifest with verified files is required to read. */
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
}
export interface MangaProgress {
  mangaId: string;
  chapterId: string;
  /** Zero-based index within a separately validated page manifest. */
  pageIndex: number;
  updatedAt: string;
}
