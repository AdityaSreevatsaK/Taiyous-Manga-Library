import {useState} from 'react';
import type {MangaEntry} from '../domain/types';

/** Authenticated same-origin artwork only. No HF URL or OAuth token reaches the DOM. */
export function MangaCoverArtwork({entry,priority=false}:{entry:MangaEntry;priority?:boolean}){
 const [failed,setFailed]=useState(false);
 if(!entry.cover||failed)return null;
 return <img className="manga-cover-image" alt="" loading={priority?"eager":"lazy"} fetchPriority={priority?"high":"auto"} decoding="async"
   src={'/api/media/cover?'+new URLSearchParams({mangaId:entry.id})}
   onError={()=>setFailed(true)} />;
}
