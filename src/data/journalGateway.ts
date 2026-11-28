import {parseJournalRecord,JOURNAL_ID,type JournalFields,type JournalRecord} from '../domain/journal';
export class JournalError extends Error {
 constructor(readonly status:number,message:string){super(message);}
}
async function request(path:string,signal?:AbortSignal,method='GET',body?:unknown):Promise<unknown>{
 const response=await fetch('/api/journal'+path,{method,signal,credentials:'same-origin',cache:'no-store',
  ...(body===undefined?{}:{body:JSON.stringify(body),headers:{'Content-Type':'application/json','X-Taiyou-Request':'journal'}})});
 if(!response.ok)throw new JournalError(response.status,response.status===401?'Sign in to access your private Journal.':
   response.status===409?'A record or archive link changed. Refresh and review before retrying.':
   response.status===503?'The Journal service is unavailable or not yet configured.':'The Journal request could not be completed.');
 return response.json();
}
export async function loadJournal(deleted:boolean,signal:AbortSignal):Promise<JournalRecord[]>{
 const entries:JournalRecord[]=[];let cursor='';
 for(let page=0;page<100;page++){
  const params=new URLSearchParams();if(deleted)params.set('deleted','true');if(cursor)params.set('after',cursor);
  const raw=await request('?'+params,signal);
  if(!raw||typeof raw!=='object')throw Error('Invalid Journal response');
  const result=raw as {schemaVersion?:unknown;entries?:unknown;nextCursor?:unknown};
  if(result.schemaVersion!==1||!Array.isArray(result.entries)||result.entries.length>100)throw Error('Invalid Journal response');
  for(const item of result.entries){
   const record=parseJournalRecord(item);
   if((record.deletedAt!==null)!==deleted||record.id<=cursor)throw Error('Invalid Journal page');
   entries.push(record);cursor=record.id;
  }
  if(result.nextCursor===null)return entries;
  if(typeof result.nextCursor!=='string'||!JOURNAL_ID.test(result.nextCursor)||result.nextCursor!==cursor||result.entries.length!==100)
    throw Error('Invalid Journal cursor');
 }
 throw Error('Journal exceeds the current list limit.');
}
export async function saveJournal(fields:JournalFields,record?:JournalRecord){
 return parseJournalRecord(await request(record?'/'+record.id:'',undefined,record?'PATCH':'POST',
  record?{...fields,revision:record.revision}:fields));
}
export async function setJournalDeleted(record:JournalRecord,deleted:boolean){
 return parseJournalRecord(await request('/'+record.id,undefined,deleted?'DELETE':'PATCH',
  deleted?{revision:record.revision}:{revision:record.revision,restore:true}));
}
