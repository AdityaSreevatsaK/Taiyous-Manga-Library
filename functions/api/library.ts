import {parseCatalogue} from '../../src/domain/validation';
import {REPO,configured,production,getSession,privateRepo,hfFetch,json,type Env} from '../_lib/mangaAuth';
interface Context{request:Request;env:Env}
const LIMIT=4*1024*1024;
export interface CloudCatalogue{schemaVersion:1;mediaKind:'manga';entries:unknown[]}
/** Treat only a truly empty data/ directory as an empty library.
 * A missing catalogue with unindexed data is a recovery error, never an excuse to overwrite.
 */
export async function emptyDataTree(sha:string,token:string):Promise<boolean>{
 const response=await hfFetch('/api/datasets/'+REPO+'/tree/'+sha+'/data?recursive=true&limit=1',token);
 if(response.status===404)return true;
 if(!response.ok)throw Error('Unable to inspect private dataset directory');
 const value:unknown=await response.json();
 if(!Array.isArray(value))throw Error('Unexpected dataset directory response');
 return value.length===0;
}
async function boundedText(response:Response):Promise<string>{
 const length=Number(response.headers.get('Content-Length')||0);
 if(length>LIMIT)throw Error('Catalogue too large');
 if(!response.body)throw Error('Catalogue body missing');
 const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
 try{
   while(true){const next=await reader.read();if(next.done)break;
     size+=next.value.byteLength;if(size>LIMIT)throw Error('Catalogue too large');
     chunks.push(next.value);
   }
 }catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 const combined=new Uint8Array(size);let off=0;
 for(const chunk of chunks){combined.set(chunk,off);off+=chunk.length;}
 return new TextDecoder('utf-8',{fatal:true}).decode(combined);
}
/** The Manga Storage Controller publishes a validated array at /catalogue.json.
 * The earlier app-only data/library.json envelope remains a read-only fallback.
 */
export function parseCloudCatalogue(raw:unknown,format:'controller'|'legacy'='legacy'){
 if(format==='controller')return parseCatalogue(raw);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid manga catalogue envelope');
 const obj=raw as Partial<CloudCatalogue>;
 if(obj.schemaVersion!==1||obj.mediaKind!=='manga'||!Array.isArray(obj.entries))
   throw Error('Unsupported manga catalogue schema');
 return parseCatalogue(obj.entries);
}
export async function hasUnindexedFiles(sha:string,token:string):Promise<boolean>{
 const response=await hfFetch('/api/datasets/'+REPO+'/tree/'+sha+'?limit=100',token);
 if(!response.ok)throw Error('Unable to inspect private dataset root');
 const listing:unknown=await response.json();
 if(!Array.isArray(listing))throw Error('Unexpected dataset tree response');
 // README and git metadata do not constitute an imported manga.
 return listing.some(item=>{
   if(!item||typeof item!=='object')throw Error('Malformed dataset tree entry');
   const path=(item as {path?:unknown}).path;
   if(typeof path!=='string')throw Error('Malformed dataset file path');
   return !['.gitattributes','README.md','.gitignore','LICENSE','LICENSE.md'].includes(path);
 });
}
export async function onRequest({request,env}:Context):Promise<Response>{
 if(!production(request))return json({error:'Private catalogue is production-only'},403);
 if(request.method!=='GET')return json({error:'Read-only endpoint'},405);
 if(!configured(env))return json({error:'Private dataset configuration incomplete'},503);
 const session=await getSession(request,env);
 if(!session)return json({error:'Sign in with Hugging Face'},401);
 const snapshot=await privateRepo(session.access);
 if(!snapshot)return json({error:'Private dataset access denied or unavailable'},403);
 try{
   // Prefer the Storage Controller's published root catalogue at an immutable revision.
   // A staged upload intentionally has no catalogue until all pages are verified.
   const controller=await hfFetch('/datasets/'+REPO+'/resolve/'+snapshot.sha+'/catalogue.json',session.access);
   if(controller.status===200){
     try{
       const entries=parseCloudCatalogue(JSON.parse(await boundedText(controller)),'controller');
       return json({connected:true,repo:REPO,revision:snapshot.sha,empty:entries.length===0,entries});
     }catch{
       return json({error:'Published manga catalogue is invalid. No data changed.'},409);
     }
   }
   if(controller.status!==404)return json({error:'Private manga catalogue could not be read'},502);
   // Backwards compatibility for early app-generated catalogues.
   const legacy=await hfFetch('/datasets/'+REPO+'/resolve/'+snapshot.sha+'/data/library.json',session.access);
   if(legacy.status===200){
     try{
       const entries=parseCloudCatalogue(JSON.parse(await boundedText(legacy)),'legacy');
       return json({connected:true,repo:REPO,revision:snapshot.sha,empty:entries.length===0,entries});
     }catch{
       return json({error:'Legacy private catalogue has invalid metadata. No data changed.'},409);
     }
   }
   if(legacy.status!==404)return json({error:'Legacy private catalogue could not be read'},502);
   if(!(await emptyDataTree(snapshot.sha,session.access)) ||
      await hasUnindexedFiles(snapshot.sha,session.access))
     return json({error:'Private manga upload is staged or unindexed. Wait for its catalogue publication; existing files were not changed.'},409);
   return json({connected:true,repo:REPO,revision:snapshot.sha,empty:true,entries:[]});
 }catch{return json({error:'Private dataset is temporarily unavailable'},502);}
}
