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
/** Read-only compatibility for previously uploaded Controller v1 catalogues.
 * Never write this format or treat it as the canonical HF schema.
 */
export function parseLegacyCatalogue(raw:unknown){
 return parseCatalogue(raw);
}
export function parseCloudCatalogue(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid manga catalogue envelope');
 const obj=raw as Partial<CloudCatalogue>;
 if(obj.schemaVersion!==1||obj.mediaKind!=='manga'||!Array.isArray(obj.entries))
   throw Error('Unsupported manga catalogue schema');
 return parseCatalogue(obj.entries);
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
   // Always request an immutable revision, not a moving /main response.
   const response=await hfFetch('/datasets/'+REPO+'/resolve/'+snapshot.sha+'/data/library.json',session.access);
   if(response.status===404){
     // Only consult the read-only legacy file when the canonical data/ tree is empty.
     // If data/ has any files, an absent canonical catalogue is a recovery conflict.
     if(!(await emptyDataTree(snapshot.sha,session.access)))
       return json({error:'Recovery required: private data exists but library.json is missing'},409);
     const legacy=await hfFetch('/datasets/'+REPO+'/resolve/'+snapshot.sha+'/catalogue.json',session.access);
     if(legacy.status===404)
       return json({connected:true,owner:session.owner,repo:REPO,revision:snapshot.sha,empty:true,entries:[]});
     if(!legacy.ok)return json({error:'Legacy private catalogue could not be read'},502);
     let legacyEntries;
     try{legacyEntries=parseLegacyCatalogue(JSON.parse(await boundedText(legacy)));}
     catch{return json({error:'Legacy private catalogue is invalid. No data changed.'},409);}
     return json({connected:true,owner:session.owner,repo:REPO,revision:snapshot.sha,empty:legacyEntries.length===0,
       legacyReadOnly:true,entries:legacyEntries});
   }
   if(!response.ok)return json({error:'Private catalogue could not be read'},502);
   let entries;
   try{entries=parseCloudCatalogue(JSON.parse(await boundedText(response)));}
   catch{return json({error:'Private catalogue has invalid or unsupported metadata. No data changed.'},409);}
   return json({connected:true,owner:session.owner,repo:REPO,revision:snapshot.sha,empty:entries.length===0,entries});
 }catch{return json({error:'Private dataset is temporarily unavailable'},502);}
}
