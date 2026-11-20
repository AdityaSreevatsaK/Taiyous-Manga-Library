import {afterEach,describe,expect,it,vi} from 'vitest';
import {preloadChapterPages} from './chapterPreloader';
import type {PageSource} from './pageSource';

const source=(index:number,onRelease=()=>{}):PageSource=>({
  src:'blob:page-'+index,fromOfflineCopy:false,release:onRelease,
});
afterEach(()=>vi.restoreAllMocks());

describe('eager, chapter-wide private page preloading',()=>{
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
