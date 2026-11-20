import {parseCatalogue,parseChapterManifest} from '../../../src/domain/validation';
import {REPO,HEADERS,configured,production,getSession,privateRepo,hfFetch,json,type Env}
  from '../../_lib/mangaAuth';
import type {ChapterManifest,MangaEntry,MangaPage,MangaCover} from '../../../src/domain/types';

interface Context {request:Request;env:Env}
const CATALOGUE_LIMIT=4*1024*1024, MANIFEST_LIMIT=1024*1024, PAGE_LIMIT=25_000_000;
const ID={manga:/^mng_[A-Za-z0-9_-]{8,64}$/,chapter:/^ch_[A-Za-z0-9_-]{8,64}$/,
  page:/^pg_[A-Za-z0-9_-]{8,64}$/};
type Layout='canonical'|'legacy';
type VerifiedIndex={entries:MangaEntry[];layout:Layout};
type CacheValue<T>={expires:number;value:Promise<T>};
/** Isolate-local SHA-pinned metadata only. Owner and private dataset SHA are still
 * checked on every request; never cache bearer tokens or image response bodies.
 */
const META_TTL_MS=30_000;
const catalogues=new Map<string,CacheValue<VerifiedIndex>>();
const manifests=new Map<string,CacheValue<ChapterManifest>>();
/** Bounded isolate-only cache of verified private cover bytes.
 * Every request still checks the signed-in owner and current private dataset SHA.
 * Never persisted, never written to Cache API or the service worker.
 */
const COVER_TTL_MS=120_000,COVER_BUDGET=12_000_000;
const verifiedCovers=new Map<string,{expires:number;bytes:ArrayBuffer;mime:string}>();
function findVerifiedCover(key:string,mime:string):ArrayBuffer|undefined{
 const hit=verifiedCovers.get(key);
 if(!hit)return;
 if(hit.expires<Date.now()||hit.mime!==mime){verifiedCovers.delete(key);return;}
 verifiedCovers.delete(key);verifiedCovers.set(key,hit);
 return hit.bytes;
}
function rememberVerifiedCover(key:string,mime:string,bytes:ArrayBuffer):void{
 if(bytes.byteLength>COVER_BUDGET)return;
 verifiedCovers.set(key,{expires:Date.now()+COVER_TTL_MS,bytes,mime});
 let total=0;
 for(const item of verifiedCovers.values())total+=item.bytes.byteLength;
 while(total>COVER_BUDGET){
  const oldest=verifiedCovers.keys().next().value;
  if(oldest===undefined)break;
  total-=verifiedCovers.get(oldest)!.bytes.byteLength;
  verifiedCovers.delete(oldest);
 }
}
function cachedMetadata<T>(cache:Map<string,CacheValue<T>>,key:string,max:number,
 loader:()=>Promise<T>):Promise<T>{
 const old=cache.get(key);
 if(old&&old.expires>Date.now())return old.value;
 if(old)cache.delete(key);
 const value=loader(),record={expires:Date.now()+META_TTL_MS,value};
 cache.set(key,record);
 while(cache.size>max){
   const oldest=cache.keys().next().value;
   if(oldest===undefined)break;
   cache.delete(oldest);
 }
 void value.catch(()=>{if(cache.get(key)===record)cache.delete(key);});
 return value;
}
/** Clears isolate-only metadata caches between mocked test fixtures. */
export function clearPrivateMediaMetadataCacheForTests():void{
 catalogues.clear();manifests.clear();verifiedCovers.clear();
}

async function bounded(response:Response,limit:number):Promise<ArrayBuffer>{
 const length=response.headers.get('Content-Length');
 if(length!==null&&Number(length)>limit)throw Error('Content exceeds safe byte limit');
 if(!response.body)throw Error('Provider returned an empty body');
 const chunks:Uint8Array[]=[];let total=0;
 const reader=response.body.getReader();
 try{
   while(true){
     const result=await reader.read();
     if(result.done)break;
     total+=result.value.byteLength;
     if(total>limit)throw Error('Provider returned too much data');
     chunks.push(result.value);
   }
 }catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return bytes.buffer;
}
async function readJson(response:Response,limit:number):Promise<unknown>{
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bounded(response,limit)));
}
function parseEnvelope(raw:unknown):MangaEntry[]{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid private library');
 const r=raw as Record<string,unknown>;
 if(r.schemaVersion!==1||r.mediaKind!=='manga')throw Error('Unknown private library version');
 return parseCatalogue(r.entries);
}
/** Never reinterpret a partially populated canonical dataset as a legacy one. */
async function fetchCatalogueAt(sha:string,token:string):Promise<VerifiedIndex>{
 const canonical=await hfFetch('/datasets/'+REPO+'/resolve/'+sha+'/data/library.json',token);
 if(canonical.ok)return {entries:parseEnvelope(await readJson(canonical,CATALOGUE_LIMIT)),layout:'canonical'};
 if(canonical.status!==404)throw Error('Private library unavailable');
 const tree=await hfFetch('/api/datasets/'+REPO+'/tree/'+sha+'/data?recursive=true&limit=1',token);
 if(tree.status!==404){
   if(!tree.ok)throw Error('Cannot verify canonical tree');
   const listing=await readJson(tree,MANIFEST_LIMIT);
   if(!Array.isArray(listing)||listing.length)throw Error('Canonical files exist without a published index');
 }
 const legacy=await hfFetch('/datasets/'+REPO+'/resolve/'+sha+'/catalogue.json',token);
 if(!legacy.ok)throw Error('Legacy catalogue unavailable');
 return {entries:parseCatalogue(await readJson(legacy,CATALOGUE_LIMIT)),layout:'legacy'};
}
function catalogueAt(sha:string,token:string):Promise<VerifiedIndex>{
 return cachedMetadata(catalogues,sha,2,()=>fetchCatalogueAt(sha,token));
}
function identity(url:URL){
 const mangaId=url.searchParams.get('mangaId')||'',chapterId=url.searchParams.get('chapterId')||'';
 const pageId=url.searchParams.get('pageId')||'';
 const revision=url.searchParams.get('revision')||'';
 if(!ID.manga.test(mangaId)||!ID.chapter.test(chapterId))return null;
 return {mangaId,chapterId,pageId,revision};
}
async function fetchManifest(sha:string,token:string,layout:Layout,mangaId:string,chapterId:string,
 expectedPageCount:number):Promise<ChapterManifest>{
 const path=layout==='canonical'?'data/manifests/':'manifests/';
 const r=await hfFetch('/datasets/'+REPO+'/resolve/'+sha+'/'+path+chapterId+'.json',token);
 if(!r.ok)throw Error('Chapter manifest unavailable');
 const manifest=parseChapterManifest(await readJson(r,MANIFEST_LIMIT));
 if(manifest.chapterId!==chapterId||manifest.pages.length!==expectedPageCount||
   manifest.pages.some(page=>!page.assetPath.startsWith('manga/'+mangaId+'/'+chapterId+'/')))
   throw Error('Chapter metadata does not match the verified catalogue');
 return manifest;
}
function readManifest(sha:string,token:string,layout:Layout,mangaId:string,chapterId:string,
 expectedPageCount:number):Promise<ChapterManifest>{
 const key=[sha,layout,mangaId,chapterId,expectedPageCount].join(':');
 return cachedMetadata(manifests,key,24,()=>
   fetchManifest(sha,token,layout,mangaId,chapterId,expectedPageCount));
}
function imageSignature(bytes:Uint8Array,page:Pick<MangaPage,'mimeType'>):boolean{
 const has=(...header:number[])=>header.every((byte,i)=>bytes[i]===byte);
 if(page.mimeType==='image/png')return has(137,80,78,71,13,10,26,10);
 if(page.mimeType==='image/jpeg')return has(255,216,255);
 if(page.mimeType==='image/webp')return has(82,73,70,70)&&
   bytes.length>=12&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80;
 return bytes.length>=12&&bytes[4]===102&&bytes[5]===116&&bytes[6]===121&&bytes[7]===112;
}
/** Private cover delivery shared by the legacy lookup and the revision-pinned fast
 * path. Only server-constructed cover paths are permitted; every byte is checked. */
async function serveCover(revision:string,access:string,
 cover:Pick<MangaCover,'assetPath'|'mimeType'|'byteSize'|'sha256'>):Promise<Response>{
 const key=[revision,cover.assetPath,cover.sha256,cover.mimeType,cover.byteSize].join(':');
 let bytes=findVerifiedCover(key,cover.mimeType);
 if(!bytes){
   const upstream=await hfFetch('/datasets/'+REPO+'/resolve/'+revision+'/data/'+cover.assetPath,access);
   if(!upstream.ok)return json({error:'Private cover is unavailable'},502);
   bytes=await bounded(upstream,Math.min(5_000_000,cover.byteSize));
   const img=new Uint8Array(bytes);
   if(img.byteLength!==cover.byteSize||!imageSignature(img,cover))
     return json({error:'Private cover failed format or size verification'},409);
   const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
     .map(byte=>byte.toString(16).padStart(2,'0')).join('');
   if(digest!==cover.sha256)return json({error:'Private cover failed checksum verification'},409);
   rememberVerifiedCover(key,cover.mimeType,bytes);
 }
 return new Response(bytes,{status:200,headers:{
   ...HEADERS,'Content-Type':cover.mimeType,'Content-Length':String(bytes.byteLength),
   'Cross-Origin-Resource-Policy':'same-origin',
 }});
}
/** GET only, owner-only and never cached; every image is verified against its manifest.
 * No paths, external URLs or authorization data are accepted from the browser.
 */
export async function onRequest({request,env}:Context):Promise<Response>{
 if(!production(request))return json({error:'Private manga media is production-only'},403);
 if(request.method!=='GET')return json({error:'Read-only endpoint'},405);
 if(!configured(env))return json({error:'Private media configuration is incomplete'},503);
 const session=await getSession(request,env);
 if(!session)return json({error:'Sign in to read private manga'},401);
 const url=new URL(request.url);
 const kind=url.pathname.split('/').at(-1);
 if(kind!=='manifest'&&kind!=='page'&&kind!=='cover')return json({error:'Not found'},404);
 if(kind==='cover'){
   const mangaId=url.searchParams.get('mangaId')||'';
   if(!ID.manga.test(mangaId))return json({error:'Invalid manga identity'},400);
   // Fast owner-only route: the signed-in /api/library call already supplied
   // this immutable revision and validated cover descriptor to the browser.
   // Do not redo Hugging Face repository and catalogue lookups for each thumbnail.
   // Nothing is public: the signed owner cookie and private HF token are required.
   const pinned=url.searchParams.get('revision');
   if(pinned!==null){
     const sha256=url.searchParams.get('sha256')||'';
     const mimeType=url.searchParams.get('mimeType')||'';
     const extension=url.searchParams.get('extension')||'';
     const rawSize=url.searchParams.get('byteSize')||'';
     const byteSize=Number(rawSize);
     const allowed=['png','jpg','jpeg','webp','avif'];
     const expectedMime=extension==='jpg'||extension==='jpeg'?'image/jpeg':'image/'+extension;
     if(!/^[a-f0-9]{40}$/.test(pinned)||!/^[a-f0-9]{64}$/.test(sha256)||
       !allowed.includes(extension)||mimeType!==expectedMime||
       !/^[1-9][0-9]{0,6}$/.test(rawSize)||byteSize<12||byteSize>5_000_000)
       return json({error:'Invalid canonical cover descriptor'},400);
     try{
       return await serveCover(pinned,session.access,{
         assetPath:'covers/'+mangaId+'.'+extension,
         mimeType:mimeType as MangaCover['mimeType'],byteSize,sha256,
       });
     }catch{return json({error:'Private cover could not be retrieved'},502);}
   }
   // Compatibility path for previously deployed clients without pinned metadata.
   const snapshot=await privateRepo(session.access);
   if(!snapshot)return json({error:'Private dataset access denied'},403);
   try{
     const {entries,layout}=await catalogueAt(snapshot.sha,session.access);
     const cover=entries.find(item=>item.id===mangaId)?.cover;
     if(layout!=='canonical'||!cover)return json({error:'No verified private cover available'},404);
     return await serveCover(snapshot.sha,session.access,cover);
   }catch{return json({error:'Private cover could not be verified or retrieved'},502);}
 }
 const ids=identity(url);
 if(!ids||(kind==='page'&&(!ID.page.test(ids.pageId)||!/^[a-f0-9]{40}$/.test(ids.revision))))
   return json({error:'Invalid chapter or page identity'},400);
 const snapshot=await privateRepo(session.access);
 if(!snapshot)return json({error:'Private dataset access denied'},403);
 if(kind==='page'&&ids.revision!==snapshot.sha)
   return json({error:'The private library changed. Reload the chapter.'},409);
 try{
   const {entries,layout}=await catalogueAt(snapshot.sha,session.access);
   const entry=entries.find(item=>item.id===ids.mangaId);
   const chapter=entry?.chapters.find(item=>item.id===ids.chapterId);
   if(!entry||!chapter||chapter.pageCount===undefined)
     return json({error:'Chapter is not in your private catalogue'},404);
   const manifest=await readManifest(snapshot.sha,session.access,layout,ids.mangaId,ids.chapterId,chapter.pageCount);
   if(kind==='manifest')return json({revision:snapshot.sha,manifest});
   const page=manifest.pages.find(item=>item.id===ids.pageId);
   if(!page)return json({error:'Page does not belong to this chapter'},404);
   const path=(layout==='canonical'?'data/':'assets/')+page.assetPath;
   const upstream=await hfFetch('/datasets/'+REPO+'/resolve/'+snapshot.sha+'/'+path,session.access);
   if(!upstream.ok)return json({error:'Private image is unavailable'},502);
   const bytes=await bounded(upstream,Math.min(PAGE_LIMIT,page.byteSize));
   const image=new Uint8Array(bytes);
   if(image.length!==page.byteSize||!imageSignature(image,page))
     return json({error:'Private image failed format or size verification'},409);
   // The exact checksum is authoritative; never render a mismatched page.
   if(!page.sha256)return json({error:'Private page lacks verified checksum'},409);
   const checksum=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
     .map(byte=>byte.toString(16).padStart(2,'0')).join('');
   if(checksum!==page.sha256)return json({error:'Private image failed checksum verification'},409);
   return new Response(bytes,{status:200,headers:{
     ...HEADERS,'Content-Type':page.mimeType,'Content-Length':String(image.length),
     'Cross-Origin-Resource-Policy':'same-origin',
   }});
 }catch{
   return json({error:'The private chapter could not be verified or retrieved'},502);
 }
}
