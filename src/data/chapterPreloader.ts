import type { PageSource } from './pageSource';
import {pagePrefetchWindow} from '../domain/pageViewport';

/** Starts the whole chapter immediately, in page order, with a small, bounded
 * number of simultaneous requests. Scrolling does not enqueue any network work.
 * A failed page never prevents subsequent pages from being attempted.
 */
export async function preloadChapterPages(
  count:number,
  load:(index:number, signal:AbortSignal)=>Promise<PageSource>,
  onLoaded:(index:number,source:PageSource)=>void,
  onFailed:(index:number,error:unknown)=>void,
  signal:AbortSignal,
  concurrency=3,
):Promise<void>{
  if(!Number.isSafeInteger(count)||count<0||count>1000)
    throw Error('Invalid chapter size');
  if(!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>4)
    throw Error('Invalid preloader concurrency');
  let cursor=0;
  const worker=async()=>{
    while(!signal.aborted){
      const index=cursor++;
      if(index>=count)return;
      try{
        const source=await load(index,signal);
        if(signal.aborted){
          source.release();
          return;
        }
        onLoaded(index,source);
      }catch(error){
        if(signal.aborted)return;
        onFailed(index,error);
      }
    }
  };
  await Promise.all(Array.from({length:Math.min(count,concurrency)},()=>worker()));
}

/** Release page blob URLs outside the small reading window. The download
 * history is tracked separately; this map contains only live in-memory URLs.
 * No chapter pages are written to CacheStorage or IndexedDB here.
 */
export function discardDistantPageSources(sources:Map<number,PageSource>,
 visibleIndex:number,count:number):number{
 const keep=new Set(pagePrefetchWindow(visibleIndex,count));
 let released=0;
 for(const [index,source] of sources){
   if(!keep.has(index)){
     source.release();sources.delete(index);released++;
   }
 }
 return released;
}

/** Limit progress-driven React renders to roughly one update per percent.
 * The actual hash/bytes verification still runs for every chapter page.
 */
export function shouldPublishChapterProgress(attempted:number,count:number):boolean{
 if(!Number.isSafeInteger(attempted)||!Number.isSafeInteger(count)||count<1)
   return false;
 return attempted===1||attempted===count||
   (attempted>0&&attempted<count&&attempted%Math.max(1,Math.ceil(count/100))===0);
}
