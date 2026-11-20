import {parseChapterManifest} from '../domain/validation';
import type {ChapterManifest,MangaEntry} from '../domain/types';
import {browserStorage,progressKey} from '../domain/localReaderStorage';
import type {PageSource} from './pageSource';

export interface PrivateChapter {manifest:ChapterManifest;revision:string}
const NO_CACHE:RequestInit={credentials:'same-origin',cache:'no-store'};
const id=(value:string)=>/^(?:mng|ch|pg)_[A-Za-z0-9_-]{8,64}$/.test(value);
const rev=(value:string)=>/^[a-f0-9]{40}$/.test(value);

function fail(status:number):never{
 if(status===401)throw Error('Your Hugging Face sign-in expired. Sign in again to read.');
 if(status===403)throw Error('Access to this private manga was denied.');
 if(status===404)throw Error('The chapter or page is not present in your private dataset.');
 if(status===409)throw Error('Your private manga changed or failed integrity checks. Reload the library.');
 throw Error('Could not load this private manga. Check your connection and retry.');
}
/** Read metadata through the same-origin authenticated Functions route.
 * The origin token never becomes available to JavaScript.
 */
export async function fetchPrivateChapter(mangaId:string,chapterId:string,
 signal?:AbortSignal):Promise<PrivateChapter>{
 if(!id(mangaId)||!id(chapterId))throw Error('Invalid private manga identity');
 const params=new URLSearchParams({mangaId,chapterId});
 const response=await fetch('/api/media/manifest?'+params,{...NO_CACHE,signal});
 if(!response.ok)fail(response.status);
 const result:unknown=await response.json();
 if(!result||typeof result!=='object')throw Error('Invalid private manga manifest response');
 const doc=result as Record<string,unknown>;
 if(typeof doc.revision!=='string'||!rev(doc.revision))
   throw Error('Invalid private manga revision');
 const manifest=parseChapterManifest(doc.manifest);
 if(manifest.chapterId!==chapterId||manifest.pages.some(p=>
   !p.assetPath.startsWith('manga/'+mangaId+'/'+chapterId+'/')))
   throw Error('Chapter pages do not belong to the selected manga');
 return {manifest,revision:doc.revision};
}
/** Returns an ephemeral blob URL for the chapter-wide preload queue.
 * The URL lives until the chapter closes; no bytes enter persistent/offline caches.
 * Aborted requests are discarded before a blob URL is created.
 */
export async function resolvePrivatePage(manifest:ChapterManifest,index:number,
 mangaId:string,revision:string,signal?:AbortSignal):Promise<PageSource>{
 if(!id(mangaId)||!rev(revision)||!Number.isSafeInteger(index)||index<0||index>=manifest.pages.length)
   throw Error('Invalid private page request');
 const page=manifest.pages[index]!;
 if(!page.assetPath.startsWith('manga/'+mangaId+'/'+manifest.chapterId+'/'))
   throw Error('Page ownership does not match the manga');
 const params=new URLSearchParams({mangaId,chapterId:manifest.chapterId,pageId:page.id,revision});
 const response=await fetch('/api/media/page?'+params,{...NO_CACHE,signal});
 if(!response.ok)fail(response.status);
 if(response.headers.get('Content-Type')?.split(';')[0]!==page.mimeType)
   throw Error('The private page returned an unexpected media format');
 const declared=Number(response.headers.get('Content-Length'));
 if(!Number.isFinite(declared)||declared!==page.byteSize||declared>25_000_000)
   throw Error('The private page returned an unexpected size');
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength!==page.byteSize)throw Error('The private image was incomplete');
 if(!page.sha256)throw Error('Private page integrity information is missing');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
   .map(byte=>byte.toString(16).padStart(2,'0')).join('');
 if(hash!==page.sha256)throw Error('Private image checksum mismatch');
 if(signal?.aborted)throw new DOMException('Chapter loading cancelled','AbortError');
 const src=URL.createObjectURL(new Blob([bytes],{type:page.mimeType}));
 return {src,fromOfflineCopy:false,release:()=>URL.revokeObjectURL(src)};
}

/** A deliberately untrusted navigation hint. The saved page is *never* treated
 * as read until the corresponding protected manifest validates its page ID.
 * Corrupt records remain unchanged for the existing backup/recovery flow.
 */
export function privateResumeChapter(entry:MangaEntry):string|null{
 const store=browserStorage();
 if(!store)return null;
 try{
   const raw=store.getItem(progressKey(entry.id));
   if(!raw)return null;
   const data:unknown=JSON.parse(raw);
   if(!data||typeof data!=='object'||Array.isArray(data))return null;
   const envelope=data as Record<string,unknown>;
   if(envelope.schemaVersion!==1||envelope.mediaKind!=='manga'||
      !envelope.progress||typeof envelope.progress!=='object')return null;
   const saved=envelope.progress as Record<string,unknown>;
   if(saved.mangaId!==entry.id||typeof saved.chapterId!=='string'||
     !id(saved.chapterId)||typeof saved.pageId!=='string'||!id(saved.pageId)||
     typeof saved.pageIndex!=='number'||!Number.isSafeInteger(saved.pageIndex)||
     saved.pageIndex<0||saved.pageIndex>=1000)return null;
   return entry.chapters.some(ch=>ch.id===saved.chapterId)?saved.chapterId:null;
 }catch{return null;}
}
