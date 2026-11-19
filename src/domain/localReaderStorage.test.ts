import { describe, expect, it } from 'vitest';
import { demoEntries, demoManifests } from '../data/fixtures';
import {
  defaultReaderPreferences, laterProgress, loadAllProgress, loadPreferences,
  loadProgress, nextProgressTimestamp, progressKey, savePreferences, saveProgress,
} from './localReaderStorage';
import type { MangaProgress } from './types';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear() { map.clear(); },
    getItem(key) { return map.get(key) ?? null; },
    key(index) { return [...map.keys()][index] ?? null; },
    removeItem(key) { map.delete(key); },
    setItem(key, value) { map.set(key, value); },
  };
}
const manga = demoEntries[0]!;
const second = demoEntries[1]!;
const firstChapter = manga.chapters[0]!.id;
function progress(series = manga, pageIndex = 0, date = '2026-11-18T00:00:00.000Z'): MangaProgress {
  const chapter = series.chapters[0]!.id;
  return {
    mangaId: series.id, chapterId: chapter, pageIndex,
    pageId: demoManifests.get(chapter)!.pages[pageIndex]!.id,
    updatedAt: date, readingMode: 'vertical', verticalOffsetRatio: 0.35,
  };
}
describe('reader local persistence', () => {
  it('saves validated page ID, reading direction and scroll anchor across independent loads', () => {
    const store = fakeStorage();
    const original = progress();
    expect(saveProgress(original, manga, demoManifests, store).status).toBe('ok');
    expect(loadProgress(manga, demoManifests, store)).toEqual({ status: 'ok', value: original });
    expect(loadAllProgress(demoEntries, demoManifests, store).progress[manga.id]).toEqual(original);
    expect(firstChapter).toBe(original.chapterId);
  });
  it('never overwrites a newer update with stale or equal timestamps', () => {
    const store = fakeStorage();
    const newer = progress(manga, 3, '2026-11-18T00:00:02Z');
    expect(saveProgress(newer, manga, demoManifests, store).status).toBe('ok');
    expect(saveProgress(progress(manga, 0), manga, demoManifests, store).status).toBe('stale');
    expect(saveProgress(newer, manga, demoManifests, store).status).toBe('stale');
    expect(loadProgress(manga, demoManifests, store)).toEqual({ status: 'ok', value: newer });
    expect(laterProgress(newer, progress(manga, 0))).toEqual(newer);
    expect(Date.parse(nextProgressTimestamp(newer))).toBeGreaterThan(Date.parse(newer.updatedAt));
  });
  it('isolates corrupt or unsupported records without erasing other manga', () => {
    const store = fakeStorage();
    saveProgress(progress(second), second, demoManifests, store);
    store.setItem(progressKey(manga.id), '{not JSON');
    const result = loadAllProgress(demoEntries, demoManifests, store);
    expect(result.invalid).toBe(1);
    expect(result.progress[second.id]?.chapterId).toBe(second.chapters[0]?.id);
    expect(store.getItem(progressKey(manga.id))).toBe('{not JSON');
    expect(saveProgress(progress(), manga, demoManifests, store).status).toBe('invalid');
  });
  it('rejects reordered pages and malformed offsets, preserving bytes', () => {
    const store = fakeStorage();
    const bad = { ...progress(), verticalOffsetRatio: 2 };
    expect(saveProgress(bad, manga, demoManifests, store).status).toBe('invalid');
    const good = progress();
    saveProgress(good, manga, demoManifests, store);
    const newManifest = new Map(demoManifests);
    const old = demoManifests.get(firstChapter)!;
    newManifest.set(firstChapter, { ...old, pages: [old.pages[1]!, old.pages[0]!, ...old.pages.slice(2)] });
    expect(loadProgress(manga, newManifest, store).status).toBe('invalid');
    expect(store.getItem(progressKey(manga.id))).toContain(good.pageId);
  });
  it('preserves preferences and ignores unsupported versions without destroying data', () => {
    const store = fakeStorage();
    expect(loadPreferences(store).status).toBe('missing');
    expect(defaultReaderPreferences.theme).toBe('sepia');
    expect(savePreferences({ ...defaultReaderPreferences, direction: 'ltr', theme: 'sepia', fit: 'width' }, store)).toBe(true);
    expect(loadPreferences(store)).toEqual({ status: 'ok', value: { direction: 'ltr', fit: 'width', theme: 'sepia' } });
    expect(savePreferences({ ...defaultReaderPreferences, direction: 'invalid' as 'rtl' }, store)).toBe(false);
    expect(loadPreferences(store).status).toBe('ok');
  });
  it('reads older dark/light themes without losing stored preferences', () => {
    const store = fakeStorage();
    store.setItem('taiyou-manga:reader-preferences', JSON.stringify({
      schemaVersion:1, mediaKind:'manga',preferences:{direction:null,fit:'page',theme:'dark'},
    }));
    expect(loadPreferences(store)).toMatchObject({status:'ok',value:{theme:'charcoal'}});
    expect(savePreferences({ ...defaultReaderPreferences, theme:'ocean' },store)).toBe(true);
    expect(loadPreferences(store)).toMatchObject({status:'ok',value:{theme:'ocean'}});
  });
  it('continues session-only reading if browser storage is blocked or full', () => {
    const denied = fakeStorage();
    denied.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(saveProgress(progress(), manga, demoManifests, null).status).toBe('unavailable');
    expect(saveProgress(progress(), manga, demoManifests, denied).status).toBe('unavailable');
    expect(savePreferences(defaultReaderPreferences, denied)).toBe(false);
    const broken = fakeStorage();
    broken.getItem = () => { throw new Error('SecurityError'); };
    expect(loadProgress(manga, demoManifests, broken).status).toBe('invalid');
  });
});
