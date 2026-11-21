import {parseCloudCatalogue} from './library';
import {slugify} from '../../src/domain/routes';
import {REPO,ORIGIN,configured,production,getSession,privateRepo,hfFetch,json,seal,unseal,clear,
  type Env,type SessionData} from '../_lib/mangaAuth';
interface Context{request:Request;env:Env}
const COOKIE='__Host-taiyou_manga_master',AAD='manga-master-grant:v1',LIFETIME=600000,MAX_CATALOGUE=4*1024*1024;
interface Grant{version:1;owner:string;fingerprint:string;expires:number}
type MasterEnv=Env&{TAIYOU_OWNER_PASSPHRASE?:string};
const ownerReady=(env:MasterEnv)=>typeof env.TAIYOU_OWNER_PASSPHRASE==='string'&&
  env.TAIYOU_OWNER_PASSPHRASE.length>=16&&env.TAIYOU_OWNER_PASSPHRASE.length<=128;
const cookieValue=(req:Request)=>(req.headers.get('Cookie')||'').split(';').map(x=>x.trim())
  .find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
const ownerCookie=(value:string)=>COOKIE+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=600';
const fingerprint=async(s:SessionData)=>Array.from(new Uint8Array(await crypto.subtle.digest(
  'SHA-256',new TextEncoder().encode(s.access)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const isWriteSession=(session:SessionData)=>typeof session.scope==='string'&&session.scope.split(/\s+/).includes('write-repos');
const sameOrigin=(request:Request)=>request.headers.get('Origin')===ORIGIN&&
 request.headers.get('X-Taiyou-Request')==='master-controls'&&
 request.headers.get('Content-Type')?.startsWith('application/json');
async function unlocked(req:Request,env:MasterEnv,session:SessionData):Promise<boolean>{
 if(!ownerReady(env))return false;
 const grant=await unseal<Grant>(cookieValue(req),env,AAD);
 return !!grant&&grant.version===1&&grant.owner===session.owner&&
   typeof grant.expires==='number'&&grant.expires>Date.now()&&
   grant.expires<=Date.now()+LIFETIME&&grant.fingerprint===await fingerprint(session);
}
async function checkPassphrase(a:string,b:string):Promise<boolean>{
 const bytes=await Promise.all([a,b].map(s=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
 const x=new Uint8Array(bytes[0]),y=new Uint8Array(bytes[1]);let diff=0;
 for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
 return diff===0;
}
async function inputJson(request:Request):Promise<Record<string,unknown>|null>{
 const length=Number(request.headers.get('Content-Length')||0);
 if(length>10000)return null;
 try{
   const body=await request.text();if(body.length>10000)return null;
   const value:unknown=JSON.parse(body);
   return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
 }catch{return null;}
}
const safeText=(value:unknown,max:number)=>typeof value==='string'&&
  value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
export interface MetadataCorrection {
  mangaId:string;revision:string;
  title?:string;creators?:string[];publicationStatus?:'unknown'|'ongoing'|'completed'|'hiatus'|'dropped';
}
/** Validates the complete field patch before any network access or data mutation. */
export function parseMetadataCorrection(input:unknown):MetadataCorrection|null{
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const obj=input as Record<string,unknown>;
 const keys=Object.keys(obj);
 if(keys.some(key=>!['mangaId','revision','title','creators','publicationStatus'].includes(key))||
   !/^mng_[a-zA-Z0-9_-]{8,64}$/.test(String(obj.mangaId))||
   !/^[a-f0-9]{40}$/.test(String(obj.revision)))return null;
 const patch:MetadataCorrection={mangaId:obj.mangaId as string,revision:obj.revision as string};
 let changed=0;
 if(obj.title!==undefined){
   if(!safeText(obj.title,180))return null;
   patch.title=(obj.title as string).trim();changed++;
 }
 if(obj.creators!==undefined){
   if(!Array.isArray(obj.creators)||obj.creators.length<1||obj.creators.length>24||
     !obj.creators.every(value=>safeText(value,120)))return null;
   const values=(obj.creators as string[]).map(v=>v.trim());
   if(new Set(values.map(v=>v.toLocaleLowerCase('en'))).size!==values.length)return null;
   patch.creators=values;changed++;
 }
 if(obj.publicationStatus!==undefined){
   if(!['unknown','ongoing','completed','hiatus','dropped'].includes(String(obj.publicationStatus)))return null;
   patch.publicationStatus=obj.publicationStatus as MetadataCorrection['publicationStatus'];changed++;
 }
 return changed>0?patch:null;
}
export function applyMetadataCorrection(document:unknown,patch:MetadataCorrection):unknown{
 parseCloudCatalogue(document);
 const original=document as {schemaVersion:1;mediaKind:'manga';entries:Record<string,unknown>[]};
 const matches=original.entries.filter(e=>e.id===patch.mangaId);
 if(matches.length!==1)throw Error('Manga ID not found or duplicated');
 const next=JSON.parse(JSON.stringify(document)) as typeof original;
 const entry=next.entries.find(e=>e.id===patch.mangaId)!;
 if(patch.title!==undefined){
   // Keep the public URL unchanged even for older records that lack a stored slug.
   if(!entry.slug)entry.slug=slugify(String(entry.title));
   entry.title=patch.title;
 }
 if(patch.creators!==undefined){
   entry.creators=patch.creators;
   // Preserve existing artists and their attribution when correcting author names.
   if(Array.isArray(entry.creatorRoles)){
     const artists=entry.creatorRoles.filter(role=>role&&typeof role==='object'&&
       (role as {role?:string}).role==='artist');
     entry.creatorRoles=[...patch.creators.map(name=>({name,role:'author'})),...artists];
   }
   if(entry.metadataSources&&typeof entry.metadataSources==='object')
     delete (entry.metadataSources as Record<string,unknown>).creators;
 }
 if(patch.publicationStatus!==undefined){
   entry.publicationStatus=patch.publicationStatus;
   if(entry.metadataSources&&typeof entry.metadataSources==='object')
     delete (entry.metadataSources as Record<string,unknown>).publicationStatus;
 }
 parseCloudCatalogue(next);
 return next;
}
async function updateCatalogue(patch:MetadataCorrection,session:SessionData):Promise<Response>{
 const snapshot=await privateRepo(session.access);
 if(!snapshot)return json({error:'Private dataset access denied'},403);
 if(snapshot.sha!==patch.revision)return json({error:'Catalogue changed; refresh before saving.'},409);
 const response=await hfFetch('/datasets/'+REPO+'/resolve/'+snapshot.sha+'/data/library.json',session.access);
 if(!response.ok)return json({error:'Canonical catalogue unavailable; no changes made.'},409);
 if(Number(response.headers.get('Content-Length')||0)>MAX_CATALOGUE)return json({error:'Catalogue too large'},413);
 let doc:unknown;
 try{
   const text=await response.text();if(text.length>MAX_CATALOGUE)return json({error:'Catalogue too large'},413);
   doc=JSON.parse(text);
 }catch{return json({error:'Catalogue could not be safely read'},409);}
 let updated:unknown;
 try{updated=applyMetadataCorrection(doc,patch);}
 catch{return json({error:'Catalogue metadata failed validation; nothing changed.'},409);}
 const operations=[
   {key:'header',value:{summary:'Correct manga publication metadata',parentCommit:snapshot.sha}},
   {key:'file',value:{path:'data/library.json',content:JSON.stringify(updated,null,2)+'\n',encoding:'utf-8'}}
 ];
 try{
   const upstream=await fetch('https://huggingface.co/api/datasets/'+REPO+'/commit/main',{
     method:'POST',headers:{Authorization:'Bearer '+session.access,
       'Content-Type':'application/x-ndjson',Accept:'application/json'},
     body:operations.map(line=>JSON.stringify(line)).join('\n')+'\n',
     cache:'no-store',signal:AbortSignal.timeout(25000),
   });
   if(upstream.status===409||upstream.status===412)return json({error:'Concurrent upload detected; refresh and retry.'},409);
   if(upstream.status===401||upstream.status===403)return json({error:'Hugging Face write permission required. Reconnect with write access.'},403);
   if(!upstream.ok)return json({error:'Hugging Face rejected the metadata change; nothing was reported as saved.'},502);
   return json({saved:true});
 }catch{return json({error:'Unable to save to Hugging Face. Check connection and retry.'},502);}
}
export async function onRequest({request,env}:Context):Promise<Response>{
 if(!production(request))return json({error:'Owner control is production only'},403);
 if(!configured(env))return json({error:'OAuth configuration incomplete'},503);
 const session=await getSession(request,env);
 if(!session)return json({error:'Owner sign-in required'},401);
 const ownerEnv=env as MasterEnv;
 const action=new URL(request.url).searchParams.get('action');
 if(request.method==='GET'&&action==='status')
   return json({configured:ownerReady(ownerEnv),
     unlocked:await unlocked(request,ownerEnv,session),writeScope:isWriteSession(session)});
 if(request.method!=='POST'||!sameOrigin(request))return json({error:'Same-origin owner action required'},403);
 const input=await inputJson(request);if(!input)return json({error:'Invalid or oversized request'},400);
 if(action==='lock'){
   const response=json({unlocked:false});response.headers.append('Set-Cookie',clear(COOKIE));return response;
 }
 if(action==='unlock'){
   if(!ownerReady(ownerEnv))return json({error:'Set TAIYOU_OWNER_PASSPHRASE in Cloudflare Production secrets first.'},503);
   if(typeof input.passphrase!=='string'||input.passphrase.length>256||
     !await checkPassphrase(input.passphrase,ownerEnv.TAIYOU_OWNER_PASSPHRASE!))
     return json({error:'Incorrect owner passphrase'},403);
   const grant:Grant={version:1,owner:session.owner,
     fingerprint:await fingerprint(session),expires:Date.now()+LIFETIME};
   const response=json({unlocked:true,configured:true,writeScope:isWriteSession(session)});
   response.headers.append('Set-Cookie',ownerCookie(await seal(grant,env,AAD)));
   return response;
 }
 if(!await unlocked(request,ownerEnv,session))return json({error:'Owner controls are locked or expired'},403);
 if(action==='update-metadata'){
   if(!isWriteSession(session))return json({error:'Reconnect with Hugging Face write permission'},403);
   const patch=parseMetadataCorrection(input);if(!patch)return json({error:'Invalid metadata correction'},400);
   return updateCatalogue(patch,session);
 }
 return json({error:'Unknown Master action'},404);
}
