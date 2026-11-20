import {useState} from 'react';
import type {MangaEntry} from '../domain/types';

/** Authenticated same-origin artwork only. No HF URL or OAuth token reaches the DOM. */
export function MangaCoverArtwork({entry}:{entry:MangaEntry}){
 const [failed,setFailed]=useState(false);
 if(!entry.coverAsset||failed)return null;
 return <img className="manga-cover-image" alt="" loading="lazy" decoding="async"
   src={'/api/media/cover?'+new URLSearchParams({mangaId:entry.id})}
   onError={()=>setFailed(true)} />;
}
