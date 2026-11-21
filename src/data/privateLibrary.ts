import { verifyPrivateCatalogue } from '../domain/privateMediaContracts';
import {setCoverCatalogueRevision} from './coverCache';
import type { MangaEntry } from '../domain/types';
/** Public app gets only validated catalogue metadata. Bearer tokens stay in HttpOnly cookies. */
export type CloudRead =
  | { status:'connected'; entries:readonly MangaEntry[]; owner:string; repo:string; revision?:string }
  | { status:'disconnected'|'unconfigured'|'unavailable'; message:string };
const NO_CACHE: RequestInit = {credentials:'same-origin',cache:'no-store'};
/** /api/library authenticates the owner and validates the private dataset itself.
 * Avoid an unnecessary sequential /api/auth/session request on every library load.
 */
export async function fetchPrivateLibrary(signal?:AbortSignal):Promise<CloudRead>{
 try{
   const result=await fetch('/api/library',{...NO_CACHE,signal});
   if(result.status===401 || result.status===404)return {status:'disconnected',
     message:'Sign in to load your private manga dataset.'};
   if(result.status===503)return {status:'unconfigured',
     message:'Cloudflare OAuth settings are missing or incomplete.'};
   if(!result.ok)return {status:'unavailable',message:result.status===409?
     'Dataset catalogue needs recovery or uses an unsupported format.' :
     'Private dataset could not be read. Check Hugging Face access and permissions.'};
   const raw:unknown=await result.json();
   if(!raw||typeof raw!=='object')return {status:'unavailable',message:'Invalid private dataset response.'};
   const state=raw as {connected?:unknown;owner?:unknown;repo?:unknown;entries?:unknown;revision?:unknown;legacyReadOnly?:unknown};
   if(state.connected!==true||state.repo!=='AdityaSreevatsaK/Taiyous-Manga'
      ||typeof state.owner!=='string'||state.owner.toLowerCase()!=='adityasreevatsak')
     return {status:'unavailable',message:'Invalid private dataset response.'};
   const entries=verifyPrivateCatalogue(state.entries);
   // Revision is optional for legacy/test responses; absent revision uses the
   // original catalogue-backed cover path instead of an unverified shortcut.
   setCoverCatalogueRevision(state.revision,state.legacyReadOnly!==true);
   return {status:'connected',owner:state.owner,repo:'AdityaSreevatsaK/Taiyous-Manga',entries,
     ...(typeof state.revision==='string'&&/^[a-f0-9]{40}$/.test(state.revision)?{revision:state.revision}:{})};
 }catch(err){
   if(signal?.aborted)throw err;
   return {status:'unavailable',message:'Private connection unavailable. Try again.'};
 }
}
