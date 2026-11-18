import { makeFixturePage } from './fixtureArt';
import { readOfflinePage } from './offlineChapters';
import type { ChapterManifest } from '../domain/types';

export interface PageSource { src: string; release: () => void; fromOfflineCopy: boolean }
/**
 * A verified offline copy wins over freshly generated fixture data. If a copy
 * claims to exist but fails integrity checks, do not silently skip it.
 */
export async function resolveSyntheticPage(manifest: ChapterManifest, index: number): Promise<PageSource> {
  if (!Number.isSafeInteger(index) || index < 0 || index >= manifest.pages.length)
    throw new Error('Invalid page selection');
  const offlineBlob = await readOfflinePage(manifest, index);
  if (offlineBlob) {
    const src = URL.createObjectURL(offlineBlob);
    return { src, fromOfflineCopy: true, release: () => URL.revokeObjectURL(src) };
  }
  return { src: makeFixturePage(manifest.chapterId, index), fromOfflineCopy: false, release: () => {} };
}
