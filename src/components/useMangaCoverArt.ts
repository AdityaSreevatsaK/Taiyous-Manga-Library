import {useEffect,useRef,useState} from 'react';
import type {MangaEntry} from '../domain/types';
import {loadMangaCover,mangaCoverKey} from '../data/coverCache';

/** Port of Novel Library useCoverArt: observer, one shared download and
 * per-component blob URLs that are revoked on unmount.
 */
export function useMangaCoverArt(entry:MangaEntry,priority:boolean){
 const wrapper=useRef<HTMLSpanElement>(null);
 const [visible,setVisible]=useState(priority);
 const [url,setUrl]=useState<string|null>(null);
 const key=mangaCoverKey(entry);
 useEffect(()=>{
  if(priority){setVisible(true);return;}
  setVisible(false);
  if(!key)return;
  const node=wrapper.current;
  if(!node||typeof IntersectionObserver==='undefined'){setVisible(true);return;}
  const observer=new IntersectionObserver(records=>{
   if(records.some(item=>item.isIntersecting)){
    setVisible(true);observer.disconnect();
   }
  },{rootMargin:'360px'});
  observer.observe(node);
  return ()=>observer.disconnect();
 },[key,priority]);
 useEffect(()=>{
  let active=true;
  let owned:string|null=null;
  setUrl(null);
  if(visible&&key){
   void loadMangaCover(entry).then(blob=>{
    if(!active||!blob)return;
    owned=URL.createObjectURL(blob);
    setUrl(owned);
   });
  }
  return ()=>{
   active=false;
   if(owned)URL.revokeObjectURL(owned);
  };
 },[entry.id,key,visible]);
 return {wrapper,url};
}
