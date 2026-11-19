/**
 * Reader geometry is vertically ordered. Binary search avoids reading the
 * bounding rectangles of every page on each scroll for very long chapters.
 * Returns -1 for empty chapters; when below the end, selects the final page.
 */
export function anchoredPageIndex(count:number,anchor:number,
  bottomAt:(index:number)=>number):number {
  if(!Number.isSafeInteger(count)||count<=0||!Number.isFinite(anchor))return -1;
  let lower=0,upper=count;
  while(lower<upper){
    const middle=lower+Math.floor((upper-lower)/2);
    if(bottomAt(middle)>anchor)upper=middle;
    else lower=middle+1;
  }
  return Math.min(lower,count-1);
}
/** At most three decoded pages are kept for any chapter size. */
export function pagePrefetchWindow(index:number,count:number):number[] {
  if(!Number.isSafeInteger(count)||count<=0||!Number.isSafeInteger(index))return [];
  const safe=Math.max(0,Math.min(index,count-1));
  const start=Math.max(0,safe-1);
  const end=Math.min(count-1,safe+1);
  return Array.from({length:end-start+1},(_,offset)=>start+offset);
}
