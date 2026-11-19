import { browserStorage } from './localReaderStorage';
import type { MangaEntry } from './types';

const PREFIX = 'taiyou-manga:personal-annotation:v1:';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_TAGS = 24;
const MAX_NOTES = 5000;
export interface PersonalAnnotation {
  mangaId: string;
  rating: number | null;
  notes: string;
  tags: string[];
  /** Device-local favourite flag. Absence in older records means not favourited. */
  favourite?: boolean;
  updatedAt: string;
}
export type AnnotationPatch = Partial<Pick<PersonalAnnotation, 'rating' | 'notes' | 'tags' | 'favourite'>>;
export type AnnotationResult =
  | { status: 'ok'; value: PersonalAnnotation | null }
  | { status: 'invalid' | 'unavailable' };
export const annotationKey = (id: string) => PREFIX + id;
const cleanKey = (tag: string) => tag.toLocaleLowerCase('en').normalize('NFC');

export function normalisePersonalTag(input: string): string {
  const cleaned = input.trim().replace(/\s+/gu, ' ').normalize('NFC');
  if (!cleaned || cleaned.length > 48 || /[\p{C}<>]/u.test(cleaned)) throw new Error('Tag must be 1–48 readable characters.');
  return cleaned.toLocaleLowerCase('en').replace(/(^|[\s/-])\p{L}/gu,
    match => match.toLocaleUpperCase('en'));
}
export function canonicalTags(tags: readonly string[]): string[] {
  if (tags.length > MAX_TAGS) throw new Error('Too many personal tags.');
  const result: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (typeof tag !== 'string') throw new Error('Invalid personal tag.');
    const value = normalisePersonalTag(tag);
    const key = cleanKey(value);
    if (seen.has(key)) throw new Error('Duplicate personal tag.');
    seen.add(key);
    result.push(value);
  }
  return result.sort((a, b) => a.localeCompare(b));
}
export function addPersonalTag(tags: readonly string[], input: string): string[] {
  const candidate = normalisePersonalTag(input);
  if (tags.some(tag => cleanKey(tag) === cleanKey(candidate))) return canonicalTags(tags);
  return canonicalTags([...tags, candidate]);
}

function isObject(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}
export function validatePersonalAnnotation(id: string, value: unknown): PersonalAnnotation {
  if (!ID.test(id) || !isObject(value) || value.mangaId !== id ||
      !(value.rating === null || (typeof value.rating === 'number' && Number.isInteger(value.rating) && value.rating >= 1 && value.rating <= 10)) ||
      typeof value.notes !== 'string' || value.notes.length > MAX_NOTES ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value.notes) ||
      !Array.isArray(value.tags) ||
      (value.favourite !== undefined && typeof value.favourite !== 'boolean') ||
      typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(value.updatedAt))
    throw new Error('Invalid personal annotation.');
  return {
    mangaId: id,
    rating: value.rating as number | null,
    notes: value.notes,
    tags: canonicalTags(value.tags),
    ...(value.favourite === true ? { favourite: true } : {}),
    updatedAt: value.updatedAt,
  };
}
export function readAnnotation(id: string, store: Storage | null = browserStorage()): AnnotationResult {
  if (!ID.test(id)) return { status: 'invalid' };
  if (!store) return { status: 'unavailable' };
  try {
    const raw = store.getItem(annotationKey(id));
    if (raw === null) return { status: 'ok', value: null };
    const object: unknown = JSON.parse(raw);
    if (!isObject(object) || object.schemaVersion !== 1 || object.mediaKind !== 'manga')
      return { status: 'invalid' };
    return { status: 'ok', value: validatePersonalAnnotation(id, object.annotation) };
  } catch { return { status: 'invalid' }; }
}
export function loadAnnotations(entries: readonly MangaEntry[], store: Storage | null = browserStorage()) {
  const annotations: Record<string, PersonalAnnotation> = {};
  let invalid = 0;
  for (const entry of entries) {
    const read = readAnnotation(entry.id, store);
    if (read.status === 'ok' && read.value) annotations[entry.id] = read.value;
    if (read.status === 'invalid') invalid++;
  }
  return { annotations, invalid, available: store !== null };
}
/** Update one validated record without overwriting corrupt data or unrelated fields. */
export function saveAnnotation(id: string, patch: AnnotationPatch, store: Storage | null = browserStorage()):
  Exclude<AnnotationResult, {status:'ok'}> | {status:'ok';value:PersonalAnnotation} {
  if (!ID.test(id)) return { status: 'invalid' };
  if (!store) return { status: 'unavailable' };
  const previous = readAnnotation(id, store);
  if (previous.status !== 'ok') return previous;
  const base: PersonalAnnotation = previous.value ?? {
    mangaId:id, rating:null, notes:'', tags:[], updatedAt:'1970-01-01T00:00:00.000Z',
  };
  let next: PersonalAnnotation;
  try {
    next = validatePersonalAnnotation(id, {
      ...base, ...patch, mangaId:id,
      updatedAt: new Date(Math.max(Date.now(),Date.parse(base.updatedAt)+1)).toISOString(),
    });
  } catch { return { status: 'invalid' }; }
  try {
    store.setItem(annotationKey(id), JSON.stringify({
      schemaVersion:1, mediaKind:'manga', annotation:next,
    }));
    return { status:'ok',value:next };
  } catch { return { status:'unavailable' }; }
}

/** Import only genuinely newer data; preserve the source timestamp and corrupt local records. */
export function importAnnotation(record: PersonalAnnotation, store: Storage | null = browserStorage()):
  'restored' | 'stale' | 'invalid' | 'unavailable' {
  let incoming: PersonalAnnotation;
  try { incoming = validatePersonalAnnotation(record.mangaId, record); }
  catch { return 'invalid'; }
  if (!store) return 'unavailable';
  const current = readAnnotation(incoming.mangaId, store);
  if (current.status !== 'ok') return current.status;
  if (current.value && Date.parse(current.value.updatedAt) >= Date.parse(incoming.updatedAt))
    return 'stale';
  try {
    store.setItem(annotationKey(incoming.mangaId), JSON.stringify({
      schemaVersion:1, mediaKind:'manga', annotation:incoming,
    }));
    return 'restored';
  } catch { return 'unavailable'; }
}
