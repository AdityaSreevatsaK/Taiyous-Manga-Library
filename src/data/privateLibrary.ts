import { verifyPrivateCatalogue } from '../domain/privateMediaContracts';
import type { MangaEntry } from '../domain/types';
/** Public app gets only validated catalogue metadata. Bearer tokens stay in HttpOnly cookies. */
export type CloudRead =
  | { status:'connected'; entries:readonly MangaEntry[]; owner:string; repo:string }
  | { status:'disconnected'|'unconfigured'|'unavailable'; message:string };
const NO_CACHE: RequestInit = {credentials:'same-origin',cache:'no-store'};
export async function fetchPrivateLibrary(signal?:AbortSignal):Promise<CloudRead>{
 try{
   const session=await fetch('/api/auth/session',{...NO_CACHE,signal});
   if(session.status===401 || session.status===404)return {status:'disconnected',message:'Sign in to load your private manga dataset.'};
   if(session.status===503)return {status:'unconfigured',message:'Cloudflare OAuth settings are missing or incomplete.'};
   if(!session.ok)return {status:'unavailable',message:'Unable to verify your private session.'};
   const state:unknown=await session.json();
   if(!state||typeof state!=='object'||(state as {connected?:unknown}).connected!==true)
     return {status:'disconnected',message:'Sign in to load your private manga dataset.'};
   const owner=(state as {owner?:unknown}).owner;
   if(typeof owner!=='string'||owner.toLowerCase()!=='adityasreevatsak')
     return {status:'unavailable',message:'Unexpected private account response.'};
   const result=await fetch('/api/library',{...NO_CACHE,signal});
   if(!result.ok)return {status:'unavailable',message:result.status===409?
     'Dataset catalogue needs recovery or uses an unsupported format.' :
     'Private dataset could not be read. Check Hugging Face access and permissions.'};
   const raw:unknown=await result.json();
   if(!raw||typeof raw!=='object'||(raw as {connected?:unknown}).connected!==true||
     (raw as {repo?:unknown}).repo!=='AdityaSreevatsaK/Taiyous-Manga')
     return {status:'unavailable',message:'Invalid private dataset response.'};
   const entries=verifyPrivateCatalogue((raw as {entries?:unknown}).entries);
   return {status:'connected',owner,repo:'AdityaSreevatsaK/Taiyous-Manga',entries};
 }catch(err){
   if(signal?.aborted)throw err;
   return {status:'unavailable',message:'Private connection unavailable. Try again.'};
 }
}
