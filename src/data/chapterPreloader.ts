import type { PageSource } from './pageSource';

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
