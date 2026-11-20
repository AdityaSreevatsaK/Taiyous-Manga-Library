import type {MangaEntry} from '../domain/types';

/**
 * Port of the Novel Library's IndexedDB "covers" store, scoped only to verified
 * manga covers. No chapter pages, provider URLs, sessions or tokens are stored.
 * The owner-authenticated catalogue must load before a component uses this.
 */
const DB_NAME='taiyou-manga-private-covers-v1';
const STORE='covers';
const MAX_COVERS=120,MAX_TOTAL_BYTES=72*1024*1024;
interface RecordCover {key:string;blob:Blob;size:number;savedAt:number}

let database:Promise<IDBDatabase>|null=null;
let generation=0;
const inflight=new Map<string,Promise<Blob|null>>();
/** A small session-only LRU avoids IndexedDB round-trips when navigating shelves.
 * The persistent IndexedDB store remains the source across page refreshes. */
const hotCovers=new Map<string,Blob>();
let hotBytes=0;
const HOT_MAX_BYTES=16*1024*1024;
const HOT_MAX_COUNT=24;
function rememberCover(key:string,blob:Blob):void{
 const previous=hotCovers.get(key);
 if(previous){hotBytes-=previous.size;hotCovers.delete(key);}
 if(blob.size>HOT_MAX_BYTES)return;
 hotCovers.set(key,blob);hotBytes+=blob.size;
 while(hotCovers.size>HOT_MAX_COUNT||hotBytes>HOT_MAX_BYTES){
  const oldest=hotCovers.keys().next().value;
  if(oldest===undefined)break;
  hotBytes-=hotCovers.get(oldest)!.size;hotCovers.delete(oldest);
 }
}
function fromHotCache(key:string):Blob|null{
 const blob=hotCovers.get(key);
 if(!blob)return null;
 hotCovers.delete(key);hotCovers.set(key,blob);
 return blob;
}

function openDatabase():Promise<IDBDatabase>{
 if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
   if(typeof indexedDB==='undefined'){reject(Error('IndexedDB unavailable'));return;}
   const request=indexedDB.open(DB_NAME,1);
   request.onupgradeneeded=()=>{
     const db=request.result;
     if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});
   };
   request.onerror=()=>reject(request.error??Error('Could not open cover storage'));
   request.onsuccess=()=>{
     const db=request.result;
     db.onversionchange=()=>{db.close();database=null;};
     resolve(db);
   };
 }).catch(error=>{database=null;throw error;});
 return database!;
}
function requestValue<T>(request:IDBRequest<T>):Promise<T>{
 return new Promise((resolve,reject)=>{
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error??Error('Cover storage request failed'));
 });
}
function validCover(entry:MangaEntry):entry is MangaEntry & {cover:NonNullable<MangaEntry['cover']>}{
 const cover=entry.cover;
 return !!cover && /^mng_[a-zA-Z0-9_-]{8,64}$/.test(entry.id)
  && /^[a-f0-9]{64}$/.test(cover.sha256)
  && /^image\/(?:jpeg|png|webp|avif)$/.test(cover.mimeType)
  && cover.byteSize>=12 && cover.byteSize<=5_000_000
  && cover.assetPath.startsWith('covers/'+entry.id+'.');
}
/** Content address, rather than a path/title, makes metadata-only updates reusable. */
export function mangaCoverKey(entry:MangaEntry):string|null{
 return validCover(entry)?entry.id+':'+entry.cover.sha256:null;
}
export function isValidCoverBlob(entry:MangaEntry,blob:Blob):boolean{
 return validCover(entry)&&blob.size===entry.cover.byteSize&&blob.type===entry.cover.mimeType;
}
async function readLocal(entry:MangaEntry,key:string):Promise<Blob|null>{
 try{
  const db=await openDatabase();
  const record=await requestValue(db.transaction(STORE,'readonly').objectStore(STORE).get(key)) as RecordCover|undefined;
  return record&&isValidCoverBlob(entry,record.blob)?record.blob:null;
 }catch{return null;}
}
async function trimCache(db:IDBDatabase):Promise<void>{
 const records=await requestValue(db.transaction(STORE,'readonly').objectStore(STORE).getAll()) as RecordCover[];
 let remaining=records.length,total=records.reduce((sum,x)=>sum+x.size,0);
 if(remaining<=MAX_COVERS&&total<=MAX_TOTAL_BYTES)return;
 const ordered=records.sort((a,b)=>a.savedAt-b.savedAt);
 const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
 for(const row of ordered){
  if(remaining<=MAX_COVERS&&total<=MAX_TOTAL_BYTES)break;
  store.delete(row.key);remaining--;total-=row.size;
 }
 await new Promise<void>((resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error??Error('Cover trim failed'));
  tx.onabort=()=>reject(tx.error??Error('Cover trim aborted'));
 });
}
async function persistVerified(entry:MangaEntry,key:string,blob:Blob,epoch:number):Promise<void>{
 if(epoch!==generation||!isValidCoverBlob(entry,blob))return;
 // Re-verify browser persistence against the exact canonical SHA, as the
 // private gateway also does. A failed verification must never enter IndexedDB.
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))]
   .map(byte=>byte.toString(16).padStart(2,'0')).join('');
 if(digest!==entry.cover!.sha256||epoch!==generation)return;
 try{
  const db=await openDatabase();
  if(epoch!==generation)return;
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).put({key,blob,size:blob.size,savedAt:Date.now()} satisfies RecordCover);
  await new Promise<void>((resolve,reject)=>{
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error??Error('Cover save failed'));
   tx.onabort=()=>reject(tx.error??Error('Cover save aborted'));
  });
  if(epoch===generation)await trimCache(db);
 }catch{/* Best effort: private images still load without browser persistence. */}
}
/**
 * Novel useCoverArt pattern: IndexedDB first, then one shared authenticated
 * gateway download per cover. Network responses remain private/no-store.
 */
export function loadMangaCover(entry:MangaEntry):Promise<Blob|null>{
 const key=mangaCoverKey(entry);
 if(!key)return Promise.resolve(null);
 const hot=fromHotCache(key);
 if(hot&&isValidCoverBlob(entry,hot))return Promise.resolve(hot);
 const pending=inflight.get(key);
 if(pending)return pending;
 const epoch=generation;
 const task=(async()=>{
  const cached=await readLocal(entry,key);
  if(epoch!==generation)return null;
  if(cached){rememberCover(key,cached);return cached;}
  if(typeof navigator!=='undefined'&&!navigator.onLine)return null;
  const response=await fetch('/api/media/cover?'+new URLSearchParams({mangaId:entry.id}),{
   credentials:'same-origin',cache:'no-store',
  });
  if(!response.ok)return null;
  const blob=await response.blob();
  if(!isValidCoverBlob(entry,blob)||epoch!==generation)return null;
  // Paint immediately. Verification and IndexedDB persistence should not
  // lengthen the first visible image's loading time.
  void persistVerified(entry,key,blob,epoch).catch(()=>{});
  rememberCover(key,blob);
  return epoch===generation?blob:null;
 })().catch(()=>null);
 inflight.set(key,task);
 void task.finally(()=>{if(inflight.get(key)===task)inflight.delete(key);});
 return task;
}
/** Explicit logout removes private artwork from browser storage, not just React. */
export async function clearMangaCoverCache():Promise<boolean>{
 generation++;
 inflight.clear();
 hotCovers.clear();hotBytes=0;
 try{
  if(typeof indexedDB==='undefined')return true;
  const db=await openDatabase();
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).clear();
  await new Promise<void>((resolve,reject)=>{
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error??Error('Cover clear failed'));
   tx.onabort=()=>reject(tx.error??Error('Cover clear aborted'));
  });
  return true;
 }catch{return false;}
}
