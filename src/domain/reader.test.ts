import { describe, expect, it } from 'vitest';
import type { ChapterManifest, MangaEntry } from './types';
import { keyNavigation, nextPreloadIndex, orderedChapters, restoreProgress, stepChapter, stepReader, swipeNavigation } from './reader';
const entry: MangaEntry = {
  kind: 'manga', id: 'mng_example001', title: 'Example', aliases: [], creators: [], tags: [],
  publicationStatus: 'completed', direction: 'rtl',
  chapters: [{ id:'ch_second000', label:'B',sequence:20 },{ id:'ch_first0000', label:'A',sequence:10 }],
};
const makeManifest = (chapterId: string, count: number): ChapterManifest => ({
  schemaVersion:1,mediaKind:'manga',chapterId,
  pages:Array.from({ length:count },(_,i)=>({
    id:'pg_page00'+i,assetPath:'manga/example/chapter/page'+i+'.png',
    mimeType:'image/png',width:800,height:1200,byteSize:1000,
  })),
});
const manifests = new Map([
  ['ch_first0000',makeManifest('ch_first0000',2)],
  ['ch_second000',makeManifest('ch_second000',3)],
]);
describe('reader traversal and exact resume', () => {
  it('sorts chapters by sequence without mutating series', () => {
    expect(orderedChapters(entry).map(x=>x.label)).toEqual(['A','B']);
    expect(entry.chapters[0]?.label).toBe('B');
  });
  it('advances across chapter boundaries and honours zero-based indexes', () => {
    expect(stepReader(entry,manifests,{chapterId:'ch_first0000',pageIndex:0},1)).toEqual({chapterId:'ch_first0000',pageIndex:1});
    expect(stepReader(entry,manifests,{chapterId:'ch_first0000',pageIndex:1},1)).toEqual({chapterId:'ch_second000',pageIndex:0});
    expect(stepReader(entry,manifests,{chapterId:'ch_second000',pageIndex:0},-1)).toEqual({chapterId:'ch_first0000',pageIndex:1});
    expect(stepReader(entry,manifests,{chapterId:'ch_first0000',pageIndex:0},-1)).toBeNull();
    expect(stepReader(entry,manifests,{chapterId:'ch_second000',pageIndex:2},1)).toBeNull();
  });
  it('never skips a missing or corrupted chapter', () => {
    expect(stepReader(entry,new Map([['ch_first0000',manifests.get('ch_first0000')!]]),{chapterId:'ch_first0000',pageIndex:1},1)).toBeNull();
    expect(stepReader(entry,manifests,{chapterId:'ch_first0000',pageIndex:44},1)).toBeNull();
  });
  it('navigates only between chapters and always opens the neighbouring chapter at its start', () => {
    expect(stepChapter(entry, manifests, {chapterId:'ch_first0000',pageIndex:1}, 1))
      .toEqual({chapterId:'ch_second000',pageIndex:0});
    expect(stepChapter(entry, manifests, {chapterId:'ch_second000',pageIndex:2}, -1))
      .toEqual({chapterId:'ch_first0000',pageIndex:0});
    expect(stepChapter(entry, manifests, {chapterId:'ch_first0000',pageIndex:1}, -1)).toBeNull();
    expect(stepChapter(entry, manifests, {chapterId:'ch_second000',pageIndex:0}, 1)).toBeNull();
    expect(stepChapter(entry, new Map(), {chapterId:'ch_first0000',pageIndex:0}, 1)).toBeNull();
  });
  it('maps physical keys and swipes correctly in RTL, LTR and vertical', () => {
    expect(keyNavigation('rtl','ArrowLeft')).toBe(1);
    expect(keyNavigation('rtl','ArrowRight')).toBe(-1);
    expect(keyNavigation('ltr','ArrowRight')).toBe(1);
    expect(keyNavigation('ltr','ArrowLeft')).toBe(-1);
    expect(keyNavigation('vertical','ArrowDown')).toBe(1);
    expect(keyNavigation('vertical','ArrowUp')).toBe(-1);
    expect(keyNavigation('rtl','Enter')).toBe(0);
    expect(swipeNavigation('rtl',75,1)).toBe(1);
    expect(swipeNavigation('ltr',-75,1)).toBe(1);
    expect(swipeNavigation('vertical',1,-75)).toBe(1);
    expect(swipeNavigation('ltr',10,1)).toBe(0);
  });
  it('preloads only one valid neighbour, not a chapter', () => {
    expect(nextPreloadIndex(0,100)).toBe(1);
    expect(nextPreloadIndex(99,100)).toBeNull();
    expect(nextPreloadIndex(-1,100)).toBeNull();
  });
  it('restores exactly, or fails closed on stale and missing pages', () => {
    const progress={mangaId:entry.id,chapterId:'ch_second000',pageIndex:2,pageId:'pg_page002',updatedAt:'2026-11-18T00:00:00Z'};
    expect(restoreProgress(entry,manifests,progress)).toEqual({chapterId:'ch_second000',pageIndex:2});
    const renamed = { ...entry, title: 'Renamed series', chapters: entry.chapters.map(chapter => ({ ...chapter, label: 'Renamed chapter' })) };
    expect(restoreProgress(renamed,manifests,progress)).toEqual({chapterId:'ch_second000',pageIndex:2});
    expect(restoreProgress(entry,manifests,{...progress,pageIndex:3})).toBeNull();
    expect(restoreProgress(entry,manifests,{...progress,pageId:'pg_page001'})).toBeNull();
    const reordered = new Map(manifests);
    const original = manifests.get('ch_second000')!;
    reordered.set('ch_second000', { ...original, pages: [original.pages[2]!, original.pages[1]!, original.pages[0]!] });
    expect(restoreProgress(entry,reordered,progress)).toBeNull();
    expect(restoreProgress(entry,new Map(),progress)).toBeNull();
  });
});
