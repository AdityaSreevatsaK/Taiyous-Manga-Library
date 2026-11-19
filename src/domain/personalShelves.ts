import { browserStorage } from './localReaderStorage';
import type { MangaEntry } from './types';

/** Personal shelves live on this device, never inside the public sample catalogue. */
export type PersonalShelf = 'trying' | 'finished' | 'to-read';
export type ShelfSelection = PersonalShelf | null;
export type ShelfWrite = 'ok' | 'invalid' | 'unavailable';
const PREFIX = 'taiyou-manga:personal-shelf:v1:';
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;
const VALID_SHELVES: readonly string[] = ['trying', 'finished', 'to-read'];

export function shelfKey(mangaId: string): string { return PREFIX + mangaId; }
export function readShelf(mangaId: string, store: Storage | null = browserStorage()):
  { status: 'ok'; value: ShelfSelection } | { status: 'invalid' | 'unavailable' } {
  if (!VALID_ID.test(mangaId)) return { status: 'invalid' };
  if (!store) return { status: 'unavailable' };
  try {
    const raw = store.getItem(shelfKey(mangaId));
    if (raw === null) return { status: 'ok', value: null };
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { status: 'invalid' };
    const value = parsed as Record<string, unknown>;
    if (value.schemaVersion !== 1 || value.mediaKind !== 'manga' ||
        value.mangaId !== mangaId || !VALID_SHELVES.includes(String(value.shelf))) return { status: 'invalid' };
    return { status: 'ok', value: value.shelf as PersonalShelf };
  } catch { return { status: 'invalid' }; }
}
export function loadShelves(entries: readonly MangaEntry[], store: Storage | null = browserStorage()) {
  const shelves: Record<string, PersonalShelf> = {};
  let invalid = 0;
  for (const item of entries) {
    const record = readShelf(item.id, store);
    if (record.status === 'ok' && record.value) shelves[item.id] = record.value;
    if (record.status === 'invalid') invalid++;
  }
  return { shelves, invalid, available: !!store };
}
export function saveShelf(mangaId: string, shelf: ShelfSelection, store: Storage | null = browserStorage()): ShelfWrite {
  if (!VALID_ID.test(mangaId) || (shelf !== null && !VALID_SHELVES.includes(shelf))) return 'invalid';
  if (!store) return 'unavailable';
  if (readShelf(mangaId, store).status === 'invalid') return 'invalid';
  try {
    if (shelf === null) store.removeItem(shelfKey(mangaId));
    else store.setItem(shelfKey(mangaId), JSON.stringify({
      schemaVersion: 1, mediaKind: 'manga', mangaId, shelf,
    }));
    return 'ok';
  } catch { return 'unavailable'; }
}
