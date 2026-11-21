import {useEffect,useRef} from 'react';

export interface MangaToastNotice {id:number;message:string}

/** Same 4.5-second lifetime and accessible dismissal as the Novel Library's
 * CollectionToast. The parent supplies a stable ID for each new update. */
export function MangaSuccessToast({toast,onDismiss}:{
 toast:MangaToastNotice;onDismiss:()=>void;
}){
 const latestDismiss=useRef(onDismiss);
 latestDismiss.current=onDismiss;
 useEffect(()=>{
  const handle=window.setTimeout(()=>latestDismiss.current(),4500);
  return ()=>window.clearTimeout(handle);
 },[toast.id]);
 return <div className="collection-change-toast" role="status"
     aria-live="polite" aria-label="Library update">
   <span className="collection-toast-symbol" aria-hidden="true">✓</span>
   <span className="collection-toast-copy">
     <strong>{toast.message}</strong>
     <small>Saved to your personal library on this device</small>
   </span>
   <button type="button" onClick={onDismiss}
     aria-label="Dismiss notification">×</button>
 </div>;
}
