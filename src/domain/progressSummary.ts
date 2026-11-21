import {browserStorage,progressKey} from './localReaderStorage';
import type {MangaEntry,MangaProgress} from './types';
/** Summary-only read of previously saved private positions, without fetching hundreds
 * of protected manifests. Reader revalidates page IDs against a manifest before use. */
export function loadProgressSummaries(entries:readonly MangaEntry[],store:Storage|null=browserStorage()):{
  progress:Record<string,MangaProgress>;invalid:number
}{
 const progress:Record<string,MangaProgress>={};let invalid=0;
 if(!store)return {progress,invalid};
 for(const entry of entries){
   try{
     const raw=store.getItem(progressKey(entry.id));if(!raw)continue;
     const decoded:unknown=JSON.parse(raw);
     if(!decoded||typeof decoded!=='object'||Array.isArray(decoded))throw Error('Envelope');
     const value=decoded as Record<string,unknown>;
     if(value.schemaVersion!==1||value.mediaKind!=='manga'||!value.progress||
       typeof value.progress!=='object'||Array.isArray(value.progress))throw Error('Envelope');
     const saved=value.progress as Record<string,unknown>;
     if(saved.mangaId!==entry.id||typeof saved.chapterId!=='string'||
       !entry.chapters.some(ch=>ch.id===saved.chapterId)||
       typeof saved.pageId!=='string'||!/^pg_[A-Za-z0-9_-]{8,64}$/.test(saved.pageId)||
       typeof saved.pageIndex!=='number'||!Number.isSafeInteger(saved.pageIndex)||
       saved.pageIndex<0||saved.pageIndex>=1000||
       typeof saved.updatedAt!=='string'||!Number.isFinite(Date.parse(saved.updatedAt))||
       !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(saved.updatedAt))throw Error('Progress');
     progress[entry.id]={mangaId:entry.id,chapterId:saved.chapterId,
       pageId:saved.pageId,pageIndex:saved.pageIndex,updatedAt:saved.updatedAt};
   }catch{invalid++;}
 }
 return {progress,invalid};
}
