import { parseProgress } from './validation';
import type { ChapterManifest, MangaEntry, MangaProgress, ReadingDirection } from './types';

const PROGRESS_PREFIX = 'taiyou-manga:progress:v1:';
const PREFERENCES_KEY = 'taiyou-manga:reader-preferences';
const directions: ReadingDirection[] = ['rtl', 'ltr', 'vertical'];

export type ImageFit = 'page' | 'width';
export type ReaderTheme = 'sepia' | 'paper' | 'charcoal' | 'midnight' | 'ocean' | 'plum';
export const readerThemes: readonly ReaderTheme[] = ['sepia', 'paper', 'charcoal', 'midnight', 'ocean', 'plum'];
export interface ReaderPreferences {
  direction: ReadingDirection | null;
  fit: ImageFit;
  theme: ReaderTheme;
}
export const defaultReaderPreferences: ReaderPreferences = { direction: null, fit: 'page', theme: 'sepia' };
export type StorageResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'missing' | 'invalid' | 'unavailable' | 'stale' };
export interface ProgressEnvelope {
  schemaVersion: 1;
  mediaKind: 'manga';
  progress: MangaProgress;
}

/** Storage is optional: third-party privacy settings and quota limits may deny all access. */
export function browserStorage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}
export function progressKey(mangaId: string) { return PROGRESS_PREFIX + mangaId; }
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function parsePreferences(raw: unknown): ReaderPreferences {
  if (!object(raw) || raw.schemaVersion !== 1 || raw.mediaKind !== 'manga' || !object(raw.preferences))
    throw new Error('Unsupported reader preferences');
  const p = raw.preferences;
  if (!(p.direction === null || (typeof p.direction === 'string' && directions.includes(p.direction as ReadingDirection))) ||
    (p.fit !== 'page' && p.fit !== 'width') ||
    !(typeof p.theme === 'string' && [...readerThemes, 'dark', 'light'].includes(p.theme)))
    throw new Error('Invalid reader preferences');
  return { direction: p.direction as ReadingDirection | null, fit: p.fit as ImageFit, theme: (p.theme === 'dark' ? 'charcoal' : p.theme === 'light' ? 'paper' : p.theme) as ReaderTheme };
}
/** Pure validation for manually imported reader settings; never writes storage. */
export function validateReaderPreferences(input: unknown): ReaderPreferences {
  return parsePreferences({ schemaVersion: 1, mediaKind: 'manga', preferences: input });
}

export function loadPreferences(store: Storage | null = browserStorage()): StorageResult<ReaderPreferences> {
  if (!store) return { status: 'unavailable' };
  try {
    const raw = store.getItem(PREFERENCES_KEY);
    if (!raw) return { status: 'missing' };
    return { status: 'ok', value: parsePreferences(JSON.parse(raw)) };
  } catch { return { status: 'invalid' }; }
}
export function savePreferences(preferences: ReaderPreferences, store: Storage | null = browserStorage()): boolean {
  if (!store) return false;
  try {
    const validated = parsePreferences({schemaVersion:1,mediaKind:'manga',preferences});
    store.setItem(PREFERENCES_KEY, JSON.stringify({schemaVersion:1,mediaKind:'manga',preferences:validated}));
    return true;
  } catch { return false; }
}
export function loadProgress(
  entry: MangaEntry,
  manifests: ReadonlyMap<string, ChapterManifest>,
  store: Storage | null = browserStorage(),
): StorageResult<MangaProgress> {
  if (!store) return { status: 'unavailable' };
  try {
    const raw = store.getItem(progressKey(entry.id));
    if (!raw) return { status: 'missing' };
    const envelope: unknown = JSON.parse(raw);
    if (!object(envelope) || envelope.schemaVersion !== 1 || envelope.mediaKind !== 'manga') return { status: 'invalid' };
    return { status: 'ok', value: parseProgress(envelope.progress, entry, manifests) };
  } catch { return { status: 'invalid' }; }
}
/**
 * Per-series records isolate corruption and preserve unrelated progress. Invalid
 * records remain untouched for manual recovery, never silently deleted.
 */
export function loadAllProgress(
  entries: readonly MangaEntry[],
  manifests: ReadonlyMap<string, ChapterManifest>,
  store: Storage | null = browserStorage(),
): { progress: Record<string, MangaProgress>; invalid: number; available: boolean } {
  const progress: Record<string, MangaProgress> = {};
  let invalid = 0;
  for (const item of entries) {
    const result = loadProgress(item, manifests, store);
    if (result.status === 'ok') progress[item.id] = result.value;
    if (result.status === 'invalid') invalid++;
  }
  return { progress, invalid, available: store !== null };
}
export function laterProgress(a: MangaProgress | undefined, b: MangaProgress | undefined): MangaProgress | undefined {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;
}

/**
 * Compare before writing. Equal or older timestamps never replace newer
 * progress, including progress written by another browser tab.
 */
export function saveProgress(
  incoming: MangaProgress,
  entry: MangaEntry,
  manifests: ReadonlyMap<string, ChapterManifest>,
  store: Storage | null = browserStorage(),
): StorageResult<MangaProgress> {
  let verified: MangaProgress;
  try { verified = parseProgress(incoming, entry, manifests); }
  catch { return { status: 'invalid' }; }
  if (!store) return { status: 'unavailable' };
  const current = loadProgress(entry, manifests, store);
  if (current.status === 'invalid') return { status: 'invalid' };
  if (current.status === 'ok' && Date.parse(current.value.updatedAt) >= Date.parse(verified.updatedAt))
    return { status: 'stale' };
  try {
    store.setItem(progressKey(entry.id), JSON.stringify({
      schemaVersion: 1, mediaKind: 'manga', progress: verified,
    } satisfies ProgressEnvelope));
    return { status: 'ok', value: verified };
  } catch { return { status: 'unavailable' }; }
}
export function nextProgressTimestamp(previous?: MangaProgress): string {
  return new Date(Math.max(Date.now(), (previous ? Date.parse(previous.updatedAt) : 0) + 1)).toISOString();
}
