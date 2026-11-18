import { makeFixturePage } from '../data/fixtureArt';
import type { ChapterManifest, MangaPage } from '../domain/types';

export const OFFLINE_CACHE_NAME = 'taiyou-manga-synthetic-chapters-v1';
export const OFFLINE_KEY_PREFIX = 'taiyou-manga:offline-chapter:v1:';
const MAX_CHAPTER_BYTES = 75 * 1024 * 1024;
const digestPattern = /^[a-f0-9]{64}$/;

export interface PageReceipt { pageId: string; sha256: string; byteSize: number }
export interface ChapterReceipt {
  schemaVersion: 1;
  mediaKind: 'manga';
  chapterId: string;
  completedAt: string;
  pages: PageReceipt[];
}
export type OfflineVerify =
  | { status: 'complete'; receipt: ChapterReceipt }
  | { status: 'missing' | 'partial' | 'corrupt' | 'unavailable' };

function hasBrowserStorage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}
function hasMediaCache() { return typeof caches !== 'undefined' && typeof crypto !== 'undefined' && !!crypto.subtle; }
function key(chapterId: string) { return OFFLINE_KEY_PREFIX + chapterId; }
export function receiptIsValid(data: unknown, manifest: ChapterManifest): data is ChapterReceipt {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const value = data as Partial<ChapterReceipt>;
  return value.schemaVersion === 1 && value.mediaKind === 'manga' && value.chapterId === manifest.chapterId &&
    typeof value.completedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.completedAt) &&
    Number.isFinite(Date.parse(value.completedAt)) &&
    Array.isArray(value.pages) && value.pages.length === manifest.pages.length &&
    value.pages.every((page, i) => page && page.pageId === manifest.pages[i]?.id &&
      typeof page.sha256 === 'string' && digestPattern.test(page.sha256) &&
      Number.isSafeInteger(page.byteSize) && page.byteSize > 0 && page.byteSize <= MAX_CHAPTER_BYTES) &&
    value.pages.reduce((sum, page) => sum + page.byteSize, 0) <= MAX_CHAPTER_BYTES;
}
export function readReceipt(manifest: ChapterManifest): { status: 'missing' | 'invalid' | 'ok'; receipt?: ChapterReceipt } {
  const store = hasBrowserStorage();
  if (!store) return { status: 'invalid' };
  try {
    const raw = store.getItem(key(manifest.chapterId));
    if (raw === null) return { status: 'missing' };
    const value: unknown = JSON.parse(raw);
    if (!receiptIsValid(value, manifest)) return { status: 'invalid' };
    return { status: 'ok', receipt: value };
  } catch { return { status: 'invalid' }; }
}
function pageUrl(chapterId: string, pageId: string): string {
  const base = new URL(import.meta.env.BASE_URL, location.origin);
  return new URL('__offline_manga__/' + encodeURIComponent(chapterId) + '/' + encodeURIComponent(pageId), base).href;
}
function decodeSyntheticPage(dataUrl: string): Blob {
  if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('Unsupported synthetic image encoding');
  const bytes = Uint8Array.from(atob(dataUrl.slice('data:image/png;base64,'.length)), char => char.charCodeAt(0));
  const expected = [137,80,78,71,13,10,26,10];
  if (expected.some((part, index) => bytes[index] !== part)) throw new Error('Invalid PNG signature');
  return new Blob([bytes], { type: 'image/png' });
}
async function hashBlob(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2,'0')).join('');
}
function assertAvailable() {
  if (!hasMediaCache() || !hasBrowserStorage()) throw new Error('Browser offline storage is unavailable');
}
async function verifyPage(cache: Cache, chapterId: string, page: MangaPage, receipt: PageReceipt): Promise<boolean> {
  const response = await cache.match(pageUrl(chapterId, page.id));
  if (!response || !response.ok || response.headers.get('content-type') !== 'image/png') return false;
  const blob = await response.blob();
  return blob.size === receipt.byteSize && (await hashBlob(blob)) === receipt.sha256;
}
export async function verifyOfflineChapter(manifest: ChapterManifest): Promise<OfflineVerify> {
  const read = readReceipt(manifest);
  if (read.status === 'missing') return { status: 'missing' };
  if (read.status !== 'ok' || !read.receipt) return { status: 'corrupt' };
  if (!hasMediaCache()) return { status: 'unavailable' };
  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    for (let index = 0; index < manifest.pages.length; index++) {
      if (!await verifyPage(cache, manifest.chapterId, manifest.pages[index]!, read.receipt.pages[index]!))
        return { status: 'partial' };
    }
    return { status: 'complete', receipt: read.receipt };
  } catch { return { status: 'unavailable' }; }
}
/** Never fetches protected media. Creates an opt-in copy of original synthetic pages. */
export async function downloadSyntheticChapter(
  manifest: ChapterManifest,
  onProgress: (completed: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ChapterReceipt> {
  assertAvailable();
  const existing = readReceipt(manifest);
  if (existing.status === 'invalid') throw new Error('Existing offline metadata is invalid; preserve it for recovery');
  if (existing.status === 'ok' && await verifyOfflineChapter(manifest).then(r=>r.status === 'complete'))
    return existing.receipt!;
  if (existing.status === 'ok') throw new Error('Offline copy is incomplete; remove the broken local copy before retrying');
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const receipts: PageReceipt[] = [];
  const written: string[] = [];
  let totalBytes = 0;
  try {
    for (let i = 0; i < manifest.pages.length; i++) {
      if (signal?.aborted) throw new Error('Chapter download cancelled');
      const page = manifest.pages[i]!;
      const image = decodeSyntheticPage(makeFixturePage(manifest.chapterId, i));
      totalBytes += image.size;
      if (totalBytes > MAX_CHAPTER_BYTES) throw new Error('Chapter exceeds the offline storage safety limit');
      const digest = await hashBlob(image);
      if (signal?.aborted) throw new Error('Chapter download cancelled');
      const url = pageUrl(manifest.chapterId, page.id);
      await cache.put(url, new Response(image, {headers:{'content-type':'image/png'}}));
      written.push(url);
      receipts.push({ pageId: page.id, sha256: digest, byteSize: image.size });
      onProgress(i + 1, manifest.pages.length);
    }
    // Two-phase completion: inspect every cached binary before committing metadata.
    for (let i = 0; i < manifest.pages.length; i++) {
      if (signal?.aborted) throw new Error('Chapter download cancelled');
      if (!await verifyPage(cache, manifest.chapterId, manifest.pages[i]!, receipts[i]!))
        throw new Error('Cached page failed integrity verification');
    }
    const receipt: ChapterReceipt = {
      schemaVersion: 1, mediaKind:'manga',chapterId:manifest.chapterId,
      completedAt:new Date().toISOString(),pages:receipts,
    };
    const store = hasBrowserStorage();
    if (!store) throw new Error('Offline metadata storage became unavailable');
    store.setItem(key(manifest.chapterId),JSON.stringify(receipt));
    return receipt;
  } catch (error) {
    // These keys belong to this new attempt; leave unrelated chapters untouched.
    await Promise.all(written.map(url => cache.delete(url).catch(() => false)));
    throw error;
  }
}
export async function removeOfflineChapter(manifest: ChapterManifest): Promise<void> {
  assertAvailable();
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  for (const page of manifest.pages) await cache.delete(pageUrl(manifest.chapterId,page.id));
  const store = hasBrowserStorage();
  if (!store) throw new Error('Cannot update offline inventory');
  store.removeItem(key(manifest.chapterId));
}
/** A recorded offline chapter never silently falls back to an unverified image. */
export async function readOfflinePage(manifest: ChapterManifest, index: number): Promise<Blob | null> {
  const read = readReceipt(manifest);
  if (read.status === 'missing') return null;
  if (read.status !== 'ok' || !read.receipt) throw new Error('Offline chapter metadata is corrupt');
  if (!hasMediaCache()) throw new Error('Offline media storage is inaccessible');
  const page = manifest.pages[index], expected = read.receipt.pages[index];
  if (!page || !expected) throw new Error('Page not found in offline chapter');
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  if (!await verifyPage(cache,manifest.chapterId,page,expected)) throw new Error('Offline page failed integrity verification');
  const response = await cache.match(pageUrl(manifest.chapterId,page.id));
  if (!response) throw new Error('Cached page missing');
  return response.blob();
}
