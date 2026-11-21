import {useEffect,useState} from 'react';
import type {MangaEntry} from '../domain/types';
import {MangaCoverArtwork} from './MangaCoverArtwork';

/** Home-only cover wrapper matching Novel Library's Cover and decoded-artwork gate. */
export function MangaHomeCover({entry,featured=false,onArtworkStateChange}:{
 entry:MangaEntry;featured?:boolean;onArtworkStateChange?:(id:string,loaded:boolean)=>void;
}){
 const [decoded,setDecoded]=useState(false);
 useEffect(()=>setDecoded(false),[entry.id,entry.cover?.sha256]);
 const onArtwork=(loaded:boolean)=>{
   setDecoded(loaded);
   onArtworkStateChange?.(entry.id,loaded);
 };
 return <span className={'cover'+(decoded?' cover-has-image':'')}>
  <span className="cover-fallback" aria-hidden="true">
    <strong>{entry.title}</strong><small>{entry.creators[0]||'Taiyou Manga Library'}</small>
  </span>
  {entry.cover&&<MangaCoverArtwork entry={entry} priority={featured} onArtworkStateChange={onArtwork}/>}
 </span>;
}
