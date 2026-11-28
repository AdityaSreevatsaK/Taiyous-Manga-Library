import {afterEach,describe,expect,it,vi} from 'vitest';
import {preloadChapterPages,discardDistantPageSources,shouldPublishChapterProgress} from './chapterPreloader';
import type {PageSource} from './pageSource';

const source=(index:number,onRelease=()=>{}):PageSource=>({
  src:'blob:page-'+index,fromOfflineCopy:false,release:onRelease,
});
afterEach(()=>vi.restoreAllMocks());

describe('eager, chapter-wide private page preloading',()=>{
  it('bounds progress-driven re-renders without skipping final verification',()=>{
    for(const count of [1,5,300,500,1000]){
      const reports=Array.from({length:count},(_,i)=>i+1)
        .filter(attempted=>shouldPublishChapterProgress(attempted,count));
      expect(reports[0]).toBe(1);
      expect(reports.at(-1)).toBe(count);
      expect(reports.length).toBeLessThanOrEqual(101);
      expect(reports).toEqual([...new Set(reports)]);
    }
    expect(shouldPublishChapterProgress(0,1000)).toBe(false);
    expect(shouldPublishChapterProgress(1001,1000)).toBe(false);
  });

  it('retains at most three blob sources across 1,000 pages and releases all others',()=>{
    const released=new Set<number>();
    const sources=new Map<number,PageSource>();
    for(let index=0;index<1000;index++)
      sources.set(index,source(index,()=>{if(released.has(index))throw Error('double release');
        released.add(index);}));
    expect(discardDistantPageSources(sources,499,1000)).toBe(997);
    expect([...sources.keys()]).toEqual([498,499,500]);
    expect(released.size).toBe(997);
    expect(discardDistantPageSources(sources,999,1000)).toBe(3);
    expect(sources.size).toBe(0);
    expect(released.size).toBe(1000);
  });
  for(const count of [300,500,1000]){
    it('verifies all '+count+' synthetic private pages while retaining only nearby sources',async()=>{
      const controller=new AbortController();
      const live=new Set<number>(),released=new Set<number>(),kept=new Map<number,PageSource>();
      const loaded:number[]=[],failed:number[]=[];
      let active=0,peak=0;
      await preloadChapterPages(count,async index=>{
        active++;peak=Math.max(peak,active);
        await Promise.resolve();
        active--;
        live.add(index);
        return source(index,()=>{
          if(released.has(index))throw Error('double release');
          released.add(index);live.delete(index);
        });
      },(index,value)=>{
        loaded.push(index);
        kept.set(index,value);
        discardDistantPageSources(kept,0,count);
      },index=>failed.push(index),controller.signal);
      expect(loaded).toHaveLength(count);
      expect(failed).toEqual([]);
      expect(peak).toBeLessThanOrEqual(3);
      expect(kept.size).toBeLessThanOrEqual(2);
      expect(live.size).toBeLessThanOrEqual(2);
      // Simulate scrolling to the last page: no retained source from the
      // chapter-wide pass should remain pinned once the viewport moves.
      discardDistantPageSources(kept,count-1,count);
      expect(kept.size).toBe(0);
      expect(released.size).toBe(count);
      expect(live.size).toBe(0);
    });
  }
  it('attempts every page without any scroll events and starts work in chapter order',async()=>{
    const starts:number[]=[],completed:number[]=[],failures:number[]=[];
    await preloadChapterPages(17,async index=>{
      starts.push(index);
      await Promise.resolve();
      return source(index);
    },index=>completed.push(index),index=>failures.push(index),new AbortController().signal);
    expect(starts).toEqual(Array.from({length:17},(_,i)=>i));
    expect(completed).toHaveLength(17);
    expect(failures).toEqual([]);
  });
  it('limits simultaneous network requests while continuing after page failures',async()=>{
    let inflight=0,peak=0;
    const loaded:number[]=[],failed:number[]=[];
    await preloadChapterPages(21,async index=>{
      inflight++;peak=Math.max(peak,inflight);
      await new Promise(resolve=>setTimeout(resolve,1));
      inflight--;
      if(index===4||index===14)throw Error('temporary page outage');
      return source(index);
    },index=>loaded.push(index),index=>failed.push(index),new AbortController().signal);
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
    expect(loaded).toHaveLength(19);
    expect(failed).toEqual([4,14]);
    expect(loaded).toContain(20);
  });
  it('stops scheduling pages on chapter switch and revokes late blob URLs',async()=>{
    const controller=new AbortController();
    const release=vi.fn();
    const starts:number[]=[],loaded:number[]=[];
    let resolveFirst:(source:PageSource)=>void=()=>{};
    const suspended=new Promise<PageSource>(resolve=>{resolveFirst=resolve;});
    const running=preloadChapterPages(40,async index=>{
      starts.push(index);
      return index===0?suspended:new Promise<PageSource>(()=>{});
    },index=>loaded.push(index),()=>{},controller.signal,1);
    controller.abort();
    resolveFirst(source(0,release));
    await running;
    expect(starts).toEqual([0]);
    expect(loaded).toEqual([]);
    expect(release).toHaveBeenCalledOnce();
  });
  it('rejects nonsensical page counts or unsafe request concurrency',async()=>{
    const callback=vi.fn(),fail=vi.fn(),signal=new AbortController().signal;
    await expect(preloadChapterPages(1001,async()=>source(0),callback,fail,signal)).rejects.toThrow('size');
    await expect(preloadChapterPages(1,async()=>source(0),callback,fail,signal,100)).rejects.toThrow('concurrency');
    expect(callback).not.toHaveBeenCalled();
  });
});
