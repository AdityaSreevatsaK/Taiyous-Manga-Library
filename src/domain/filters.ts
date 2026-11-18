import type { MangaEntry, PublicationStatus } from './types';
import { searchCatalogue } from './search';
export type SortMode = 'title' | 'chapters' | 'rating';
export function filterCatalogue(
  entries: readonly MangaEntry[], query: string, status: PublicationStatus | 'all',
  tag: string, collection: string, sort: SortMode,
): MangaEntry[] {
  const filtered = searchCatalogue(entries, query).filter(entry =>
    (status === 'all' || entry.publicationStatus === status) &&
    (!tag || entry.tags.includes(tag)) &&
    (!collection || (entry.collections ?? []).includes(collection)));
  return filtered.sort((a, b) =>
    sort === 'chapters' ? b.chapters.length - a.chapters.length || a.title.localeCompare(b.title) :
    sort === 'rating' ? (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title) :
    a.title.localeCompare(b.title));
}
