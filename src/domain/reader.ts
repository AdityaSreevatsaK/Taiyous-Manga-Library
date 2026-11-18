import type { ChapterManifest, MangaEntry, MangaProgress, ReadingDirection } from './types';

export interface ReaderLocation { chapterId: string; pageIndex: number }
export function orderedChapters(entry: MangaEntry) {
  return [...entry.chapters].sort((a, b) => a.sequence - b.sequence);
}
/** Next/Previous follow canonical page order, never reorder the actual image array. */
export function stepReader(
  entry: MangaEntry,
  manifests: ReadonlyMap<string, ChapterManifest>,
  location: ReaderLocation,
  delta: -1 | 1,
): ReaderLocation | null {
  const chapters = orderedChapters(entry);
  const index = chapters.findIndex(chapter => chapter.id === location.chapterId);
  if (index < 0) return null;
  const current = manifests.get(location.chapterId);
  if (!current || current.chapterId !== location.chapterId || current.pages.length === 0 ||
      location.pageIndex < 0 || location.pageIndex >= current.pages.length) return null;
  const nextPage = location.pageIndex + delta;
  if (nextPage >= 0 && nextPage < current.pages.length) return { chapterId: location.chapterId, pageIndex: nextPage };
  const adjacentChapter = chapters[index + delta];
  if (!adjacentChapter) return null;
  const adjacentManifest = manifests.get(adjacentChapter.id);
  // Never skip corrupt or missing chapters, or silently jump across a gap.
  if (!adjacentManifest || adjacentManifest.chapterId !== adjacentChapter.id || adjacentManifest.pages.length === 0) return null;
  return {
    chapterId: adjacentChapter.id,
    pageIndex: delta === 1 ? 0 : adjacentManifest.pages.length - 1,
  };
}
/** Arrow direction is visual; physical navigation changes for RTL reading. */
export function keyNavigation(direction: ReadingDirection, key: string): -1 | 0 | 1 {
  if (direction === 'vertical') return key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
  const positive = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const negative = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  return key === positive ? 1 : key === negative ? -1 : 0;
}
export function swipeNavigation(direction: ReadingDirection, deltaX: number, deltaY: number): -1 | 0 | 1 {
  if (direction === 'vertical') {
    if (Math.abs(deltaY) < 55 || Math.abs(deltaY) < Math.abs(deltaX)) return 0;
    return deltaY < 0 ? 1 : -1;
  }
  if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY)) return 0;
  return deltaX > 0 ? (direction === 'rtl' ? 1 : -1) : (direction === 'rtl' ? -1 : 1);
}
/** Exactly one neighbour in reading order; never preload an entire chapter. */
export function nextPreloadIndex(pageIndex: number, pageCount: number): number | null {
  if (!Number.isSafeInteger(pageIndex) || pageIndex < 0 || pageIndex >= pageCount) return null;
  return pageIndex + 1 < pageCount ? pageIndex + 1 : null;
}
export function restoreProgress(
  entry: MangaEntry,
  manifests: ReadonlyMap<string, ChapterManifest>,
  progress: MangaProgress | undefined,
): ReaderLocation | null {
  if (!progress || progress.mangaId !== entry.id || !entry.chapters.some(chapter => chapter.id === progress.chapterId)) return null;
  const manifest = manifests.get(progress.chapterId);
  if (!manifest || manifest.chapterId !== progress.chapterId ||
      !Number.isSafeInteger(progress.pageIndex) || progress.pageIndex < 0 ||
      progress.pageIndex >= manifest.pages.length ||
      manifest.pages[progress.pageIndex]?.id !== progress.pageId) return null;
  return { chapterId: progress.chapterId, pageIndex: progress.pageIndex };
}
