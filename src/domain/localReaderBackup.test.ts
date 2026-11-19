import { describe, expect, it } from 'vitest';
import { demoEntries, demoManifests } from '../data/fixtures';
import { loadPreferences, loadProgress, progressKey, savePreferences, saveProgress } from './localReaderStorage';
import {
  exportLocalReaderBackup, previewLocalReaderBackup, restoreLocalReaderBackup, type LocalReaderBackup,
} from './localReaderBackup';
import type { MangaEntry, MangaProgress } from './types';

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
function progress(entry: MangaEntry, index: number, updatedAt: string): MangaProgress {
  const chapterId = entry.chapters[0]!.id;
  return {
    mangaId: entry.id, chapterId, pageIndex: index,
    pageId: demoManifests.get(chapterId)!.pages[index]!.id, updatedAt,
    readingMode: 'vertical', verticalOffsetRatio: 0.3,
  };
}
const first = demoEntries[0]!;
const second = demoEntries[1]!;
const oldTime = '2026-11-18T00:00:00.000Z';
const recentTime = '2026-11-19T00:00:00.000Z';
function backup(records: MangaProgress[]): LocalReaderBackup {
  return {
    schemaVersion: 1, mediaKind: 'manga', kind: 'taiyou-manga-local-reader-backup',
    exportedAt: '2026-11-19T04:00:00.000Z', progress: records, preferences: null,
  };
}

describe('manual browser-only progress transfer', () => {
  it('exports validated chapter/page identities and reader preferences without media or titles', () => {
    const store = fakeStorage();
    saveProgress(progress(first, 2, recentTime), first, demoManifests, store);
    savePreferences({ direction:'vertical', fit:'width', theme:'sepia' }, store);
    const result = exportLocalReaderBackup(demoEntries, demoManifests, store, new Date(recentTime));
    expect(result.document.progress).toHaveLength(1);
    expect(result.document.progress[0]?.pageIndex).toBe(2);
    expect(result.document.preferences?.theme).toBe('sepia');
    expect(result.document.exportedAt).toBe(recentTime);
    const json = JSON.stringify(result.document);
    expect(json).not.toContain('data:image');
    expect(json).not.toContain('assetPath');
    expect(json).not.toContain(first.title);
  });

  it('fails closed on malformed schema, duplicates, incorrect positions and settings', () => {
    const store = fakeStorage();
    const original = backup([progress(first, 0, oldTime)]);
    const inspect = (raw: unknown) => previewLocalReaderBackup(raw, demoEntries, demoManifests, store);
    expect(() => inspect({...original,schemaVersion:2})).toThrow('supported');
    expect(() => inspect({...original,progress:[original.progress[0],original.progress[0]]})).toThrow('duplicate');
    expect(() => inspect({...original,progress:[{...original.progress[0],pageId:'pg_wrongid00'}]})).toThrow('invalid chapter');
    expect(() => inspect({...original,preferences:{direction:'invalid',fit:'page',theme:'dark'}})).toThrow('invalid reading preferences');
    expect(() => inspect({...original,progress:new Array(2001).fill(original.progress[0])})).toThrow('supported');
    expect(store.length).toBe(0);
  });

  it('keeps newer local records and applies only newer backup progress', () => {
    const store = fakeStorage();
    const newerLocal = progress(first, 1, recentTime);
    const olderBackup = progress(first, 0, oldTime);
    const newBackup = progress(second, 2, recentTime);
    saveProgress(newerLocal, first, demoManifests, store);
    const plan = previewLocalReaderBackup(backup([olderBackup,newBackup]), demoEntries, demoManifests, store);
    expect(plan.newerOrEqual).toBe(1);
    expect(plan.restorable).toBe(1);
    const result = restoreLocalReaderBackup(plan,demoEntries,demoManifests,store);
    expect(result).toMatchObject({ restored:1, newerOrEqual:1, invalidLocal:0, unavailable:0 });
    expect(loadProgress(first,demoManifests,store)).toEqual({status:'ok',value:newerLocal});
    expect(loadProgress(second,demoManifests,store)).toEqual({status:'ok',value:newBackup});
    const again = restoreLocalReaderBackup(plan,demoEntries,demoManifests,store);
    expect(again.restored).toBe(0);
    expect(again.newerOrEqual).toBe(2);
  });

  it('preserves corrupt local data, skips unknown series, and never overwrites without confirmation', () => {
    const store = fakeStorage();
    const firstRecord = progress(first,0,oldTime);
    const unknown = { ...firstRecord, mangaId: 'mng_unknown001' };
    store.setItem(progressKey(first.id), '{corrupt-json');
    const plan = previewLocalReaderBackup(backup([firstRecord, unknown]),demoEntries,demoManifests,store);
    expect(plan.ignoredUnknown).toBe(1);
    expect(plan.invalidLocal).toBe(1);
    expect(store.getItem(progressKey(first.id))).toBe('{corrupt-json');
    const result=restoreLocalReaderBackup(plan,demoEntries,demoManifests,store);
    expect(result).toMatchObject({restored:0,invalidLocal:1,ignoredUnknown:1});
    expect(store.getItem(progressKey(first.id))).toBe('{corrupt-json');
    expect(store.getItem(progressKey(unknown.mangaId))).toBeNull();
  });

  it('does not change reading settings unless the user opts in', () => {
    const store = fakeStorage();
    const input=backup([]);
    input.preferences={direction:'ltr',fit:'width',theme:'sepia'};
    savePreferences({direction:'vertical',fit:'page',theme:'charcoal'},store);
    const plan=previewLocalReaderBackup(input,demoEntries,demoManifests,store);
    restoreLocalReaderBackup(plan,demoEntries,demoManifests,store);
    expect(loadPreferences(store)).toMatchObject({status:'ok',value:{theme:'charcoal'}});
    const opted=restoreLocalReaderBackup(plan,demoEntries,demoManifests,store,true);
    expect(opted.preferencesRestored).toBe(true);
    expect(loadPreferences(store)).toMatchObject({status:'ok',value:{direction:'vertical',fit:'width',theme:'sepia'}});
  });

  it('reports unavailable storage without damaging source progress', () => {
    const plan=previewLocalReaderBackup(backup([progress(first,1,recentTime)]),demoEntries,demoManifests,null);
    const result=restoreLocalReaderBackup(plan,demoEntries,demoManifests,null);
    expect(result).toMatchObject({restored:0,unavailable:1});
    expect(() => exportLocalReaderBackup(demoEntries,demoManifests,null)).toThrow('not available');
  });
});
