import type { ChapterManifest, MangaEntry } from './types';
import { loadAnnotations, readAnnotation, importAnnotation, validatePersonalAnnotation,
  type PersonalAnnotation } from './personalAnnotations';
import { loadShelves, readShelf, saveShelf, type PersonalShelf } from './personalShelves';
import { exportLocalReaderBackup, previewLocalReaderBackup, restoreLocalReaderBackup,
  type LocalReaderBackup, type BackupPreview, type BackupRestoreResult } from './localReaderBackup';

const KIND = 'taiyou-manga-local-personal-backup';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
export const MAX_FULL_BACKUP_BYTES = 2 * 1024 * 1024;
export interface ShelfBackupItem { mangaId: string; shelf: PersonalShelf }
export interface FullBackupV2 {
  schemaVersion: 2;
  kind: typeof KIND;
  mediaKind: 'manga';
  exportedAt: string;
  reader: LocalReaderBackup;
  shelves: ShelfBackupItem[];
  annotations: PersonalAnnotation[];
}
export type AnyMangaBackup = FullBackupV2 | LocalReaderBackup;
export interface FullBackupPreview {
  document: AnyMangaBackup;
  reader: BackupPreview;
  shelves: ShelfBackupItem[];
  annotations: PersonalAnnotation[];
  shelfRestorable: number;
  annotationRestorable: number;
  conflicts: number;
  unknownPersonal: number;
}
export interface FullBackupRestoreResult {
  reader: BackupRestoreResult;
  shelvesRestored: number;
  annotationsRestored: number;
  metadataSkipped: number;
  metadataUnavailable: number;
}
function object(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}
/** Export only locally validated personal records, never manga files, images or credentials. */
export function exportFullBackup(entries: readonly MangaEntry[],
  manifests: ReadonlyMap<string,ChapterManifest>, store: Storage | null, now = new Date()) {
  if (!store) throw new Error('Browser storage is unavailable.');
  const progress = exportLocalReaderBackup(entries,manifests,store,now);
  const shelf = loadShelves(entries,store);
  const notes = loadAnnotations(entries,store);
  const document: FullBackupV2 = {
    schemaVersion:2,mediaKind:'manga',kind:KIND,exportedAt:now.toISOString(),
    reader:progress.document,
    shelves:Object.entries(shelf.shelves).map(([mangaId,value])=>({mangaId,shelf:value}))
      .sort((a,b)=>a.mangaId.localeCompare(b.mangaId)),
    annotations:Object.values(notes.annotations).sort((a,b)=>a.mangaId.localeCompare(b.mangaId)),
  };
  if (new TextEncoder().encode(JSON.stringify(document)).length > MAX_FULL_BACKUP_BYTES)
    throw new Error('Personal backup exceeds the 2 MB safety limit.');
  return {document,excludedInvalid:progress.excludedInvalid+shelf.invalid+notes.invalid};
}
export function previewFullBackup(raw: unknown, entries: readonly MangaEntry[],
  manifests: ReadonlyMap<string,ChapterManifest>,store:Storage|null): FullBackupPreview {
  if (!object(raw)) throw new Error('This is not a supported Manga Library backup.');
  const isV2 = raw.schemaVersion === 2 && raw.kind === KIND && raw.mediaKind === 'manga';
  if (raw.schemaVersion !== 1 && !isV2)
    throw new Error('This is not a supported Manga Library backup.');
  if (isV2 && (!Array.isArray(raw.shelves) || raw.shelves.length > 2000 ||
      !Array.isArray(raw.annotations) || raw.annotations.length > 2000 ||
      typeof raw.exportedAt !== 'string' || !Number.isFinite(Date.parse(raw.exportedAt))))
    throw new Error('This personal backup has an invalid structure.');
  const reader = previewLocalReaderBackup(isV2 ? raw.reader : raw,entries,manifests,store);
  const known = new Set(entries.map(entry=>entry.id));
  const shelves: ShelfBackupItem[] = [];
  const annotations: PersonalAnnotation[] = [];
  const seenShelf = new Set<string>();
  const seenAnnotation = new Set<string>();
  let unknownPersonal = 0;
  let shelfRestorable = 0;
  let annotationRestorable = 0;
  let conflicts = 0;
  if (isV2) {
    for (const candidate of raw.shelves as unknown[]) {
      if (!object(candidate) || typeof candidate.mangaId !== 'string' ||
          !ID.test(candidate.mangaId) || seenShelf.has(candidate.mangaId) ||
          (candidate.shelf !== 'trying' && candidate.shelf !== 'finished' && candidate.shelf !== 'to-read'))
        throw new Error('Personal backup contains an invalid or duplicate reading shelf.');
      seenShelf.add(candidate.mangaId);
      if (!known.has(candidate.mangaId)) {unknownPersonal++;continue;}
      const record: ShelfBackupItem = { mangaId:candidate.mangaId,shelf:candidate.shelf };
      shelves.push(record);
      const existing=readShelf(record.mangaId,store);
      if (existing.status === 'ok' && !existing.value) shelfRestorable++;
      else conflicts++;
    }
    for (const candidate of raw.annotations as unknown[]) {
      if (!object(candidate) || typeof candidate.mangaId !== 'string' ||
          !ID.test(candidate.mangaId) || seenAnnotation.has(candidate.mangaId))
        throw new Error('Personal backup contains an invalid or duplicate annotation ID.');
      seenAnnotation.add(candidate.mangaId);
      let record: PersonalAnnotation;
      try {record=validatePersonalAnnotation(candidate.mangaId,candidate);}
      catch {throw new Error('Personal backup contains invalid notes, rating or tags. Nothing was imported.');}
      if (!known.has(record.mangaId)) {unknownPersonal++;continue;}
      annotations.push(record);
      const existing=readAnnotation(record.mangaId,store);
      if (existing.status === 'ok' &&
          (!existing.value || Date.parse(existing.value.updatedAt) < Date.parse(record.updatedAt)))
        annotationRestorable++;
      else conflicts++;
    }
  }
  return {
    document: isV2 ? raw as unknown as FullBackupV2 : reader.document,
    reader,shelves,annotations,shelfRestorable,annotationRestorable,conflicts,unknownPersonal,
  };
}
/** Explicitly confirmed merge. Existing shelves are not replaced; only newer notes can be restored. */
export function restoreFullBackup(preview: FullBackupPreview,entries: readonly MangaEntry[],
  manifests: ReadonlyMap<string,ChapterManifest>,store:Storage|null,
  restoreSettings=false,restorePersonal=false):FullBackupRestoreResult {
  // Revalidate all entries before touching any storage. No destructive mutations.
  const checked = previewFullBackup(preview.document,entries,manifests,store);
  const reader = restoreLocalReaderBackup(checked.reader,entries,manifests,store,restoreSettings);
  let shelvesRestored=0,annotationsRestored=0,metadataSkipped=0,metadataUnavailable=0;
  if (restorePersonal) {
    for (const shelf of checked.shelves) {
      const current=readShelf(shelf.mangaId,store);
      if (current.status !== 'ok' || current.value) {
        if (current.status === 'unavailable') metadataUnavailable++;else metadataSkipped++;
        continue;
      }
      const result=saveShelf(shelf.mangaId,shelf.shelf,store);
      if (result === 'ok') shelvesRestored++;
      else if(result === 'unavailable') metadataUnavailable++;
      else metadataSkipped++;
    }
    for (const record of checked.annotations) {
      const result=importAnnotation(record,store);
      if (result === 'restored') annotationsRestored++;
      else if(result === 'unavailable') metadataUnavailable++;
      else metadataSkipped++;
    }
  }
  return {reader,shelvesRestored,annotationsRestored,metadataSkipped,metadataUnavailable};
}
