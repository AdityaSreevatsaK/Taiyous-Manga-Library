import {beforeEach,describe,expect,it,vi} from 'vitest';
import {clearMangaUsage,emptyMangaUsage,mangaDuration,readMangaUsage,recordMangaAction,recordMangaUsage,setMangaUsageEnabled} from './usageAnalytics';
const data=new Map<string,string>();
beforeEach(()=>{
  data.clear();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>data.get(k)??null,
    setItem:(k:string,v:string)=>{data.set(k,v);}},dispatchEvent:()=>true});
  vi.stubGlobal('Event',class{constructor(public type:string){}});
});
describe('Manga usage journal',()=>{
 it('counts bounded foreground time by title and local day',()=>{
   const now=new Date('2026-11-21T10:00:00Z');
   recordMangaUsage(90000,'mng_silvergarden',false,now);
   recordMangaUsage(6000,null,true,now);
   expect(readMangaUsage().mangaReadingMs.mng_silvergarden).toBe(30000);
   expect(readMangaUsage().days['2026-11-21']).toMatchObject({appMs:36000,readingMs:30000,offlineMs:6000});
   expect(mangaDuration(3600000)).toBe('1h 0m');
 });
 it('records verified chapter/page actions, suppressing duplicate reports',()=>{
   const now=new Date('2026-11-21T10:00:00Z');
   const e={mangaId:'mng_silvergarden',kind:'page-viewed' as const,chapterId:'ch_silvergarden',page:4};
   recordMangaAction(e,now);recordMangaAction(e,new Date(now.getTime()+1000));
   recordMangaAction({...e,page:5},new Date(now.getTime()+2000));
   expect(readMangaUsage().events.map(x=>x.page)).toEqual([4,5]);
 });
 it('honours disabled tracking and clearing without touching progress',()=>{
   recordMangaUsage(5000,'mng_silvergarden',false);setMangaUsageEnabled(false);
   recordMangaAction({kind:'chapter-opened',mangaId:'mng_silvergarden'});
   recordMangaUsage(10000,'mng_silvergarden',false);
   expect(readMangaUsage().events).toHaveLength(0);
   expect(readMangaUsage().mangaReadingMs.mng_silvergarden).toBe(5000);
   expect(clearMangaUsage()).toEqual(emptyMangaUsage(false));
 });
 it('recovers from invalid saved analytics',()=>{
   data.set('taiyou-manga:usage:v1','{invalid');expect(readMangaUsage()).toEqual(emptyMangaUsage());
 });
});
