import {configured,getSession,json,ORIGIN,production,type Env} from './mangaAuth';
import {JOURNAL_ID,parseJournalFields,parseJournalRecord,journalFields,type JournalRecord} from '../../src/domain/journal';
import {parseImportCandidates,previewCandidates,type ImportCandidate,type TitleIndex} from '../../src/domain/journalImport';
import {parseBackupEntries,recoveryPreview} from '../../src/domain/journalBackup';
// Structural subset of D1 keeps this module independent of Worker type packages.
interface Statement {
 bind(...values:(string|number|null)[]):Statement;
 first<T>():Promise<T|null>;
 all<T>():Promise<{success:boolean;results:T[]}>;
 run():Promise<{success:boolean;meta:{changes:number}}>;
}
interface Database {prepare(sql:string):Statement;batch(statements:Statement[]):Promise<{success:boolean;meta:{changes:number}}[]>}
interface JournalEnv extends Env {JOURNAL_DB?:Database}
interface Context {request:Request;env:JournalEnv}
interface Row {id:string;revision:number;created_at:string;updated_at:string;deleted_at:string|null;library_manga_id:string|null;payload:string}
const fields='id,revision,created_at,updated_at,deleted_at,library_manga_id,payload';
function decode(row:Row):JournalRecord{
 const p:unknown=JSON.parse(row.payload);
 const parsed=parseJournalFields(p);
 if(parsed.libraryMangaId!==row.library_manga_id)throw Error('Invalid link index');
 return parseJournalRecord({...p as object,schemaVersion:1,id:row.id,revision:row.revision,
  createdAt:row.created_at,updatedAt:row.updated_at,deletedAt:row.deleted_at});
}
const error=(message:string,status:number)=>json({error:message},status);
const MAX_BODY=65536;
async function input(request:Request):Promise<Record<string,unknown>>{
 if(Number(request.headers.get('Content-Length')||0)>MAX_BODY||!request.body)throw Error('Invalid body');
 const reader=request.body.getReader();let size=0;const decoder=new TextDecoder('utf-8',{fatal:true});let text='';
 try{while(true){const chunk=await reader.read();if(chunk.done)break;
   size+=chunk.value.byteLength;if(size>MAX_BODY)throw Error('Body too large');
   text+=decoder.decode(chunk.value,{stream:true});
 }text+=decoder.decode();}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 const raw:unknown=JSON.parse(text);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid body');
 return raw as Record<string,unknown>;
}
const revisionOk=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=1&&v<Number.MAX_SAFE_INTEGER;
export async function journalRequest({request,env}:Context,id?:string):Promise<Response>{
 if(!production(request))return error('Journal is production-only',403);
 if(!configured(env))return error('Owner authentication unavailable',503);
 // The sealed session already verifies the exact owner and expiry. Do not require
 // HF dataset availability or write-repos permission for independent Journal data.
 if(!await getSession(request,env))return error('Sign in with Hugging Face',401);
 const method=request.method;
 if(id!==undefined&&!JOURNAL_ID.test(id))return error('Invalid journal ID',400);
 if(!((id===undefined&&['GET','POST'].includes(method))||(id!==undefined&&['PATCH','DELETE'].includes(method))))return error('Method not allowed',405);
 if(method!=='GET'&&(request.headers.get('Origin')!==ORIGIN||
   request.headers.get('X-Taiyou-Request')!=='journal'||
   request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase()!=='application/json'))
   return error('Same-origin Journal request required',403);
 const db=env.JOURNAL_DB;if(!db)return error('Journal database is not configured',503);
 try{
  if(method==='GET'){
    const query=new URL(request.url).searchParams;
    const after=query.get('after')??'';
    if(after&&!JOURNAL_ID.test(after))return error('Invalid cursor',400);
    const deleted=query.get('deleted');
    if(deleted!==null&&deleted!=='true')return error('Invalid deleted filter',400);
    const predicate=deleted==='true'?'deleted_at IS NOT NULL':'deleted_at IS NULL';
    const result=await db.prepare('SELECT '+fields+' FROM journal_entries WHERE '+predicate+' AND id > ? ORDER BY id LIMIT 101').bind(after).all<Row>();
    if(!result.success)throw Error('Read failed');
    const entries=result.results.slice(0,100).map(decode);
    return json({schemaVersion:1,entries,nextCursor:result.results.length>100?entries.at(-1)!.id:null});
  }
  let body:Record<string,unknown>;try{body=await input(request);}catch{return error('Invalid Journal request',400);}
  if(method==='POST'){
    let data;try{data=parseJournalFields(body);}catch{return error('Invalid Journal entry',400);}
    const now=new Date().toISOString(),newId='jrn_'+crypto.randomUUID().replace(/-/g,'');
    const record=parseJournalRecord({...data,schemaVersion:1,id:newId,revision:1,createdAt:now,updatedAt:now,deletedAt:null});
    const result=await db.prepare('INSERT OR IGNORE INTO journal_entries (id,revision,created_at,updated_at,deleted_at,library_manga_id,payload) VALUES (?,1,?,?,NULL,?,?) RETURNING id')
      .bind(newId,now,now,data.libraryMangaId,JSON.stringify(data)).all<{id:string}>();
    if(!result.success)throw Error('Write failed');
    return result.results.length===1&&result.results[0]?.id===newId?json(record,201):error('Record or archive link conflict',409);
  }
  const {revision,restore,...patch}=body;
  if(!revisionOk(revision))return error('Record revision required',400);
  const row=await db.prepare('SELECT '+fields+' FROM journal_entries WHERE id = ?').bind(id!).first<Row>();
  if(!row)return error('Journal entry not found',404);
  const previous=decode(row);
  if(previous.revision!==revision)return error('Record changed; reload before editing',409);
  let nextFields=journalFields(previous),deletedAt=previous.deletedAt;
  const now=new Date(Math.max(Date.now(),Date.parse(previous.updatedAt))).toISOString();
  if(method==='DELETE'){
    if(Object.keys(patch).length||restore!==undefined||deletedAt!==null)return error('Invalid deletion',400);
    deletedAt=now;
  }else if(restore===true){
    if(Object.keys(patch).length||deletedAt===null)return error('Invalid restoration',400);
    deletedAt=null;
  }else{
    if(restore!==undefined||deletedAt!==null||!Object.keys(patch).length)return error('Invalid update',400);
    try{nextFields=parseJournalFields({...nextFields,...patch});}catch{return error('Invalid Journal entry',400);}
  }
  const record=parseJournalRecord({...nextFields,schemaVersion:1,id:id!,revision:revision+1,
    createdAt:previous.createdAt,updatedAt:now,deletedAt});
  const result=await db.prepare('UPDATE OR IGNORE journal_entries SET revision = ?, updated_at = ?, deleted_at = ?, library_manga_id = ?, payload = ? WHERE id = ? AND revision = ? RETURNING id')
   .bind(record.revision,now,deletedAt,nextFields.libraryMangaId,JSON.stringify(nextFields),id!,revision).all<{id:string}>();
  if(!result.success)throw Error('Write failed');
  return result.results.length===1&&result.results[0]?.id===id?json(record):error('Record or archive link conflict; reload before editing',409);
 }catch{return error('Journal temporarily unavailable; no automatic retry',503);}
}

async function currentVersion(db:Database):Promise<number>{
 const state=await db.prepare('SELECT revision FROM journal_state WHERE singleton = 1').first<{revision:number}>();
 if(!state||!Number.isSafeInteger(state.revision)||state.revision<0)throw Error('Import migration missing');
 return state.revision;
}
async function importPreview(db:Database,rows:ImportCandidate[]){
 const version=await currentVersion(db);
 const data=await db.prepare("SELECT json_extract(payload,'$.title') AS title,json_extract(payload,'$.alternativeTitles') AS aliases FROM journal_entries LIMIT 10001").all<{title:string;aliases:string}>();
 if(!data.success||data.results.length>10000)throw Error('Import index unavailable');
 const index:TitleIndex[]=data.results.map(x=>{
  const aliases:unknown=JSON.parse(x.aliases);if(typeof x.title!=='string'||!Array.isArray(aliases)||!aliases.every(y=>typeof y==='string'))throw Error('Invalid title index');
  return {title:x.title,alternativeTitles:aliases as string[]};
 });
 if(await currentVersion(db)!==version)return null;
 return {version,rows:previewCandidates(rows,index)};
}
async function digest(rows:unknown):Promise<string>{
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(rows)));
 return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function journalImportRequest({request,env}:Context,action:string):Promise<Response>{
 if(!production(request))return error('Journal is production-only',403);
 if(!configured(env))return error('Owner authentication unavailable',503);
 if(!await getSession(request,env))return error('Sign in with Hugging Face',401);
 if(request.method!=='POST'||!['preview','commit'].includes(action))return error('Method not allowed',405);
 if(request.headers.get('Origin')!==ORIGIN||request.headers.get('X-Taiyou-Request')!=='journal'||
 request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase()!=='application/json')return error('Same-origin Journal request required',403);
 const db=env.JOURNAL_DB;if(!db)return error('Journal database is not configured',503);
 let rows:ImportCandidate[],version:unknown;
 try{const body=await input(request);if(Object.keys(body).sort().join(',')!==(action==='preview'?'rows':'rows,version'))throw Error('Invalid request');
  rows=parseImportCandidates(body.rows);version=body.version;
  if(action==='commit'&&(typeof version!=='number'||!Number.isSafeInteger(version)||version<0))throw Error('Invalid version');
 }catch{return error('Invalid import request',400);}
 try{
  if(action==='preview'){const result=await importPreview(db,rows);return result?json(result):error('Journal changed; preview again',409);}
  const id=await digest(rows);
  const receipt=()=>db.prepare('SELECT entry_count FROM journal_import_receipts WHERE batch_id = ?').bind(id).first<{entry_count:number}>();
  const earlier=await receipt();if(earlier)return json({batchId:id,count:earlier.entry_count,replayed:true});
  const result=await importPreview(db,rows);
  if(!result||result.version!==version||result.rows.some(x=>x.status!=='addition'))return error('Journal changed or title conflict; preview again',409);
  const now=new Date().toISOString();
  const statements=[db.prepare('INSERT INTO journal_import_receipts(batch_id,entry_count,committed_at,snapshot_valid) VALUES (?,?,?,(SELECT revision = ? FROM journal_state WHERE singleton=1))')
   .bind(id,rows.length,now,version as number),
   ...rows.map(row=>db.prepare('INSERT INTO journal_entries(id,revision,created_at,updated_at,deleted_at,library_manga_id,payload) VALUES (?,1,?,?,NULL,NULL,?)')
    .bind('jrn_'+crypto.randomUUID().replace(/-/g,''),now,now,JSON.stringify(row.fields)))];
  try{
   const results=await db.batch(statements);
   // These are strict INSERTs, not OR IGNORE. A constraint failure aborts the whole D1 batch.
   // D1 meta.changes can include the journal_state trigger; do not equate it to row count.
   if(results.length!==statements.length||results.some(x=>!x.success||x.meta.changes<1))throw Error('Batch verification failed');
   const saved=await receipt();if(!saved||saved.entry_count!==rows.length)throw Error('Missing batch receipt');
  }catch{
   const saved=await receipt();if(saved)return json({batchId:id,count:saved.entry_count,replayed:true});
   if(await currentVersion(db)!==version)return error('Journal changed; preview again',409);
   return error('Import unavailable; no automatic retry',503);
  }
  return json({batchId:id,count:rows.length,replayed:false},201);
 }catch{return error('Import unavailable',503);}
}

/** A consistent, private backup snapshot; recovery only inserts missing IDs. */
export async function journalBackupRequest({request,env}:Context,action:string):Promise<Response>{
 if(!production(request))return error('Journal is production-only',403);
 if(!configured(env))return error('Owner authentication unavailable',503);
 if(!await getSession(request,env))return error('Sign in with Hugging Face',401);
 const db=env.JOURNAL_DB;if(!db)return error('Journal database is not configured',503);
 if(action==='export'&&request.method==='GET'){
  const q=new URL(request.url).searchParams,after=q.get('after')??'',rawVersion=q.get('version');
  if(after&&!JOURNAL_ID.test(after)||after&&rawVersion===null||rawVersion!==null&&!/^\d+$/.test(rawVersion))return error('Invalid backup cursor',400);
  try{
   const version=await currentVersion(db);
   if(rawVersion!==null&&Number(rawVersion)!==version)return error('Journal changed during backup; start again',409);
   const data=await db.prepare('SELECT '+fields+' FROM journal_entries WHERE id > ? ORDER BY id LIMIT 101').bind(after).all<Row>();
   if(!data.success)throw Error('Backup read failed');
   const entries=data.results.slice(0,100).map(decode);
   if(await currentVersion(db)!==version)return error('Journal changed during backup; start again',409);
   return json({version,entries,nextCursor:data.results.length>100?entries.at(-1)!.id:null});
  }catch{return error('Backup unavailable',503);}
 }
 if(request.method!=='POST'||!['preview','restore'].includes(action))return error('Method not allowed',405);
 if(request.headers.get('Origin')!==ORIGIN||request.headers.get('X-Taiyou-Request')!=='journal'||
 request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase()!=='application/json')return error('Same-origin Journal request required',403);
 let entries:JournalRecord[],requested:unknown;
 try{
  const body=await input(request);
  if(Object.keys(body).sort().join(',')!==(action==='preview'?'entries':'entries,version'))throw Error('Invalid request');
  entries=parseBackupEntries(body.entries,50);requested=body.version;
  if(!entries.length||action==='restore'&&(typeof requested!=='number'||!Number.isSafeInteger(requested)||requested<0))throw Error('Invalid request');
 }catch{return error('Invalid recovery batch',400);}
 try{
  const version=await currentVersion(db);
  const key='backup:'+await digest(entries);
  const receipt=()=>db.prepare('SELECT entry_count FROM journal_import_receipts WHERE batch_id=?').bind(key).first<{entry_count:number}>();
  if(action==='restore'){
   const saved=await receipt();if(saved)return json({count:saved.entry_count,replayed:true});
   if(requested!==version)return error('Journal changed; review recovery again',409);
  }
  // Query only incoming IDs and active archive links, not all private payloads.
  const ids=entries.map(x=>x.id),links=entries.filter(x=>x.deletedAt===null&&x.libraryMangaId).map(x=>x.libraryMangaId!);
  const placeholders=(n:number)=>Array(n).fill('?').join(',');
  const result=await db.prepare('SELECT '+fields+' FROM journal_entries WHERE id IN ('+placeholders(ids.length)+')'+
    (links.length?' OR (deleted_at IS NULL AND library_manga_id IN ('+placeholders(links.length)+'))':'')).bind(...ids,...links).all<Row>();
  if(!result.success)throw Error('Recovery index unavailable');
  const rows=recoveryPreview(entries,result.results.map(decode));
  if(await currentVersion(db)!==version)return error('Journal changed; review recovery again',409);
  if(action==='preview')return json({version,rows});
  if(rows.some(x=>x.status!=='addition'))return error('Recovery has conflicts or existing records; review again',409);
  const statements=[db.prepare('INSERT INTO journal_import_receipts(batch_id,entry_count,committed_at,snapshot_valid) VALUES (?,?,?,(SELECT revision = ? FROM journal_state WHERE singleton=1))')
   .bind(key,entries.length,new Date().toISOString(),version),
   ...entries.map(x=>db.prepare('INSERT INTO journal_entries(id,revision,created_at,updated_at,deleted_at,library_manga_id,payload) VALUES (?,?,?,?,?,?,?)')
    .bind(x.id,x.revision,x.createdAt,x.updatedAt,x.deletedAt,x.libraryMangaId,JSON.stringify(journalFields(x))))];
  try{
   const results=await db.batch(statements);
   if(results.length!==statements.length||results.some(x=>!x.success||x.meta.changes<1))throw Error('Recovery write failed');
   const saved=await receipt();if(!saved||saved.entry_count!==entries.length)throw Error('Recovery receipt missing');
  }catch{
   const saved=await receipt();if(saved)return json({count:saved.entry_count,replayed:true});
   if(await currentVersion(db)!==version)return error('Journal changed; review recovery again',409);
   return error('Recovery unavailable; no automatic retry',503);
  }
  return json({count:entries.length,replayed:false},201);
 }catch{return error('Recovery unavailable',503);}
}
