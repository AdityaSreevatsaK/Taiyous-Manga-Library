import { describe,expect,it } from 'vitest';
import { anchoredPageIndex,pagePrefetchWindow } from './pageViewport';

describe('bounded page windowing for long manga chapters',()=>{
  it('matches linear anchor tracking for 1, 5, 300 and 1,000 pages',()=>{
    for(const count of [1,5,300,1000]){
      const heights=Array.from({length:count},(_,i)=>i%7===0?2200:850);
      const bottoms:number[]=[];let sum=0;
      for(const height of heights){sum+=height;bottoms.push(sum);}
      const anchors=[-5,0,849,850,1700,Math.floor(sum/2),sum-1,sum,sum+200];
      for(const anchor of anchors){
        const expected=bottoms.findIndex(bottom=>bottom>anchor);
        const result=anchoredPageIndex(count,anchor,i=>bottoms[i]!);
        expect(result).toBe(expected===-1?count-1:expected);
      }
    }
  });
  it('checks at most logarithmic page bounds for a 1,000-page chapter',()=>{
    const size=1000;
    let calls=0;
    const found=anchoredPageIndex(size,500450,index=>{
      calls++;return(index+1)*1000;
    });
    expect(found).toBe(500);
    expect(calls).toBeLessThanOrEqual(11);
  });
  it('never prefetches more than three pages, even at chapter boundaries',()=>{
    expect(pagePrefetchWindow(0,1000)).toEqual([0,1]);
    expect(pagePrefetchWindow(499,1000)).toEqual([498,499,500]);
    expect(pagePrefetchWindow(999,1000)).toEqual([998,999]);
    expect(pagePrefetchWindow(0,1)).toEqual([0]);
    expect(pagePrefetchWindow(0,0)).toEqual([]);
    expect(pagePrefetchWindow(1000,1000)).toEqual([998,999]);
    for(let i=0;i<1000;i++){
      const indices=pagePrefetchWindow(i,1000);
      expect(indices.length).toBeLessThanOrEqual(3);
      expect(indices).toContain(i);
    }
  });
  it('handles malformed parameters without probing geometry',()=>{
    expect(anchoredPageIndex(0,0,()=>{throw Error('unexpected');})).toBe(-1);
    expect(anchoredPageIndex(100,Number.NaN,()=>{throw Error('unexpected');})).toBe(-1);
    expect(pagePrefetchWindow(Number.NaN,1000)).toEqual([]);
  });
});
