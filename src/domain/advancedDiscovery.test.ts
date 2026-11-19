import { describe,expect,it } from 'vitest';
import { demoEntries } from '../data/fixtures';
import { applyAdvancedDiscovery,computeLocalReadingAnalytics,defaultAdvancedCriteria,
  type ReadingContext } from './advancedDiscovery';
const a=demoEntries[0]!,b=demoEntries[1]!,c=demoEntries[2]!;
function context():ReadingContext {
  const time='2026-11-19T10:00:00.000Z';
  return {progress:{
      [a.id]:{mangaId:a.id,chapterId:a.chapters[0]!.id,pageId:'pg_test',pageIndex:2,updatedAt:time},
      [b.id]:{mangaId:b.id,chapterId:b.chapters[1]!.id,pageId:'pg_test',pageIndex:1,updatedAt:'2026-11-19T11:00:00.000Z'},
    },shelves:{[a.id]:'finished'},annotations:{[b.id]:{mangaId:b.id,rating:10,notes:'',tags:[],updatedAt:time}},
    offlineChapterIds:new Set([b.chapters[0]!.id])};
}
describe('compound advanced manga discovery',()=>{
  it('combines creator, chapter count, personal ratings and offline availability',()=>{
    const criteria={...defaultAdvancedCriteria(),creator:'TAIYOU',minChapters:3,
      minPersonalRating:9,offlineState:'downloaded' as const};
    expect(applyAdvancedDiscovery(demoEntries,criteria,context()).map(x=>x.id)).toEqual([b.id]);
    expect(applyAdvancedDiscovery(demoEntries,{...criteria,maxChapters:2},context())).toEqual([]);
  });
  it('distinguishes personally finished, currently reading and unstarted',()=>{
    const base=defaultAdvancedCriteria(),ctx=context();
    expect(applyAdvancedDiscovery(demoEntries,{...base,readingState:'finished'},ctx).map(x=>x.id)).toEqual([a.id]);
    expect(applyAdvancedDiscovery(demoEntries,{...base,readingState:'reading'},ctx).map(x=>x.id)).toEqual([b.id]);
    expect(applyAdvancedDiscovery(demoEntries,{...base,readingState:'unstarted'},ctx).map(x=>x.id)).toContain(c.id);
  });
  it('rejects contradictory or malformed ranges without changing source data',()=>{
    const criteria={...defaultAdvancedCriteria(),minChapters:6,maxChapters:2};
    const source=[...demoEntries];
    expect(applyAdvancedDiscovery(demoEntries,criteria,context())).toEqual([]);
    expect(applyAdvancedDiscovery(demoEntries,{...criteria,minChapters:-1,maxChapters:null},context())).toEqual([]);
    expect(demoEntries).toEqual(source);
  });
  it('derives only grounded reading metrics from local records, not invented durations',()=>{
    const metrics=computeLocalReadingAnalytics(demoEntries,context());
    expect(metrics).toMatchObject({total:4,started:2,reading:1,finished:1,
      offlineSeries:1,downloadedChapters:1,rated:1,avgRating:10});
    expect(metrics.recent[0]?.mangaId).toBe(b.id);
    expect(metrics.genres.some(genre=>genre.name==='Adventure')).toBe(true);
    expect('readingMinutes' in metrics).toBe(false);
  });
});
