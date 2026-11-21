import {useEffect,useState} from 'react';
import type {MangaEntry} from '../domain/types';
import {useMangaCoverArt} from './useMangaCoverArt';

/** Novel-style local cover art, sourced only from the authenticated manga gateway.
 * Blob URLs are per component and revoked on unmount; never expose HF paths.
 */
export function MangaCoverArtwork({entry,priority=false,onArtworkStateChange}:{entry:MangaEntry;priority?:boolean;onArtworkStateChange?:(loaded:boolean)=>void}){
 const {wrapper,url}=useMangaCoverArt(entry,priority);
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[entry.id,entry.cover?.sha256]);
 if(!entry.cover)return null;
 return <span className="manga-cover-loader" ref={wrapper} aria-hidden="true">
   {url&&!failed&&<img className="manga-cover-image" alt="" src={url}
     loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'}
     decoding="async" onLoad={()=>onArtworkStateChange?.(true)}
     onError={()=>{setFailed(true);onArtworkStateChange?.(false);}}/>}
 </span>;
}
