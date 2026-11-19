import {
  loadAllProgress, loadPreferences, loadProgress, savePreferences, saveProgress,
  validateReaderPreferences, type ReaderPreferences,
} from './localReaderStorage';
import { parseProgress } from './validation';
import type { ChapterManifest, MangaEntry, MangaProgress } from './types';

export const MAX_READER_BACKUP_BYTES = 256 * 1024;
const BACKUP_KIND = 'taiyou-manga-local-reader-backup';

export interface LocalReaderBackup {
  schemaVersion: 1;
  mediaKind: 'manga';
  kind: typeof BACKUP_KIND;
  exportedAt: string;
  progress: MangaProgress[];
  preferences: ReaderPreferences | null;
}
export interface BackupExport {
  document: LocalReaderBackup;
  excludedInvalid: number;
}
export interface BackupPreview {
  document: LocalReaderBackup;
  recognised: MangaProgress[];
  ignoredUnknown: number;
  newerOrEqual: number;
  invalidLocal: number;
  restorable: number;
}
export interface BackupRestoreResult {
  restored: number;
  newerOrEqual: number;
  invalidLocal: number;
  unavailable: number;
  ignoredUnknown: number;
  preferencesRestored: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && /^mng_[a-zA-Z0-9_-]{8,64}$/.test(value);
}

/** Export validated progress only. Private image bytes, metadata and secrets are never included. */
export function exportLocalReaderBackup(
  entries: readonly MangaEntry[],
  manifests: ReadonlyMap<string, ChapterManifest>,
  store: Storage | null,
  now = new Date(),
): BackupExport {
  if (!store) throw new Error('Local browser storage is not available.');
  const all = loadAllProgress(entries, manifests, store);
  const preferences = loadPreferences(store);
  const document: LocalReaderBackup = {
    schemaVersion: 1, mediaKind: 'manga', kind: BACKUP_KIND,
    exportedAt: now.toISOString(),
    progress: Object.values(all.progress).sort((a, b) => a.mangaId.localeCompare(b.mangaId)),
    preferences: preferences.status === 'ok' ? preferences.value : null,
  };
  return { document, excludedInvalid: all.invalid + (preferences.status === 'invalid' ? 1 : 0) };
}

/** Entire file is validated before any writes. Unknown series can be ignored safely. */
export function previewLocalReaderBackup(
  raw: unknown,
  entries: readonly MangaEntry[],
  manifests: ReadonlyMap<string, ChapterManifest>,
  store: Storage | null,
): BackupPreview {
  if (!isObject(raw) || raw.schemaVersion !== 1 || raw.mediaKind !== 'manga' ||
      raw.kind !== BACKUP_KIND || !Array.isArray(raw.progress) ||
      raw.progress.length > 2000 || typeof raw.exportedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(raw.exportedAt) ||
      !Number.isFinite(Date.parse(raw.exportedAt))) {
    throw new Error('This is not a supported Manga Library reader backup.');
  }
  const catalogued = new Map(entries.map(entry => [entry.id, entry] as const));
  const recognised: MangaProgress[] = [];
  const seen = new Set<string>();
  let ignoredUnknown = 0;
  let newerOrEqual = 0;
  let invalidLocal = 0;
  let restorable = 0;
  for (const candidate of raw.progress) {
    if (!isObject(candidate) || !validId(candidate.mangaId) || seen.has(candidate.mangaId)) {
      throw new Error('Backup contains an invalid or duplicate manga progress ID.');
    }
    seen.add(candidate.mangaId);
    const entry = catalogued.get(candidate.mangaId);
    if (!entry) { ignoredUnknown++; continue; }
    let record: MangaProgress;
    try { record = parseProgress(candidate, entry, manifests); }
    catch { throw new Error('Backup contains an invalid chapter, page or reading position. Nothing was imported.'); }
    recognised.push(record);
    const current = loadProgress(entry, manifests, store);
    if (current.status === 'invalid') invalidLocal++;
    else if (current.status === 'ok' && Date.parse(current.value.updatedAt) >= Date.parse(record.updatedAt)) newerOrEqual++;
    else restorable++;
  }
  let preferences: ReaderPreferences | null = null;
  if (raw.preferences !== null) {
    try { preferences = validateReaderPreferences(raw.preferences); }
    catch { throw new Error('Backup contains invalid reading preferences. Nothing was imported.'); }
  }
  return {
    document: {
      schemaVersion: 1, mediaKind: 'manga', kind: BACKUP_KIND,
      exportedAt: raw.exportedAt,
      progress: recognised, preferences,
    },
    recognised, ignoredUnknown, newerOrEqual, invalidLocal, restorable,
  };
}

/** Merge only newer progress after rechecking current browser records. Never delete or overwrite malformed data. */
export function restoreLocalReaderBackup(
  preview: BackupPreview,
  entries: readonly MangaEntry[],
  manifests: ReadonlyMap<string, ChapterManifest>,
  store: Storage | null,
  restorePreferences = false,
): BackupRestoreResult {
  if (!store) return {
    restored: 0, newerOrEqual: 0, invalidLocal: 0, unavailable: preview.recognised.length,
    ignoredUnknown: preview.ignoredUnknown, preferencesRestored: false,
  };
  // Revalidate against the currently selected catalogue rather than trusting a stale UI preview.
  const confirmed = previewLocalReaderBackup(preview.document, entries, manifests, store);
  let restored = 0;
  let newerOrEqual = 0;
  let invalidLocal = 0;
  let unavailable = 0;
  const byId = new Map(entries.map(entry => [entry.id, entry] as const));
  for (const record of confirmed.recognised) {
    const entry = byId.get(record.mangaId);
    if (!entry) { unavailable++; continue; }
    const outcome = saveProgress(record, entry, manifests, store);
    if (outcome.status === 'ok') restored++;
    else if (outcome.status === 'stale') newerOrEqual++;
    else if (outcome.status === 'invalid') invalidLocal++;
    else unavailable++;
  }
  const preferencesRestored = restorePreferences && confirmed.document.preferences !== null ?
    savePreferences({ ...confirmed.document.preferences, direction: 'vertical' }, store) : false;
  return { restored, newerOrEqual, invalidLocal, unavailable,
    ignoredUnknown: confirmed.ignoredUnknown + preview.ignoredUnknown, preferencesRestored };
}
