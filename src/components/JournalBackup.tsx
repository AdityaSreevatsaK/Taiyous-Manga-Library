import {useState,type ChangeEvent} from 'react';
import {parseJournalRecord,JOURNAL_ID,type JournalRecord} from '../domain/journal';
import {BACKUP_BYTES,BACKUP_LIMIT,parseJournalBackup,type RecoveryRow} from '../domain/journalBackup';
async function request(path:string,body?:unknown){
 const r=await fetch('/api/journal/backup/'+path,{credentials:'same-origin',cache:'no-store',
  ...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Taiyou-Request':'journal'},body:JSON.stringify(body)})});
 if(!r.ok)throw Error(r.status===401?'Sign in again.':r.status===409?'Journal changed; review again.':'Backup or recovery unavailable.');
 return r.json();
}
export default function JournalBackup({onCommitted}:{onCommitted:()=>void}){
 const [entries,setEntries]=useState<JournalRecord[]>([]),[page,setPage]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [review,setReview]=useState<{version:number;rows:RecoveryRow[];entries:JournalRecord[]}|null>(null);
 const [done,setDone]=useState<string[]>([]);
 const remaining=entries.filter(x=>!done.includes(x.id)),current=remaining.slice(page*50,(page+1)*50);
 async function exportAll(){
  setBusy(true);setNotice('');
  try{
   const all:JournalRecord[]=[];let after='',version:number|undefined;
   for(let i=0;i<=100;i++){
    const p=new URLSearchParams();if(after)p.set('after',after);if(version!==undefined)p.set('version',String(version));
    const result=await request('export?'+p);
    if(!Number.isSafeInteger(result.version)||result.version<0||(version!==undefined&&result.version!==version)||!Array.isArray(result.entries)||result.entries.length>100)throw Error('Invalid backup page');
    version=result.version;
    for(const raw of result.entries){const record=parseJournalRecord(raw);if(record.id<=after)throw Error('Invalid backup cursor');after=record.id;all.push(record);}
    if(all.length>BACKUP_LIMIT)throw Error('Backup exceeds supported size');
    if(result.nextCursor===null){
     const content=JSON.stringify(parseJournalBackup({format:'taiyou-manga-journal',schemaVersion:1,exportedAt:new Date().toISOString(),entries:all}),null,2);
     if(new TextEncoder().encode(content).length>BACKUP_BYTES)throw Error('Backup exceeds supported size');
     const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='manga-journal-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
     setNotice('Exported '+all.length+' active and removed records. Keep this private file securely.');return;
    }
    if(!JOURNAL_ID.test(result.nextCursor)||result.nextCursor!==after||result.entries.length!==100)throw Error('Invalid backup cursor');
   }
   throw Error('Backup exceeds supported page limit');
  }catch(e){setNotice(e instanceof Error?e.message:'Backup failed');}finally{setBusy(false);}
 }
 async function readFile(event:ChangeEvent<HTMLInputElement>){
  setEntries([]);setReview(null);setDone([]);setPage(0);setNotice('');
  const file=event.target.files?.[0];if(!file)return;
  setBusy(true);
  try{if(file.size>BACKUP_BYTES)throw Error('Backup file exceeds 20 MiB');
   const backup=parseJournalBackup(JSON.parse(await file.text()));setEntries(backup.entries);
   setNotice('Validated '+backup.entries.length+' backup records. Review before restoring.');
  }catch(e){setNotice(e instanceof Error?e.message:'Invalid backup');}finally{setBusy(false);}
 }
 async function preview(){
  setBusy(true);setReview(null);setNotice('');
  try{
   const batch=[...current];while(batch.length>1&&new TextEncoder().encode(JSON.stringify({version:0,entries:batch})).length>60*1024)batch.pop();
   if(!batch.length||new TextEncoder().encode(JSON.stringify({version:0,entries:batch})).length>60*1024)throw Error('Recovery record too large');
   const value=await request('preview',{entries:batch});
   if(!Number.isSafeInteger(value.version)||!Array.isArray(value.rows)||value.rows.length!==batch.length||value.rows.some((x:RecoveryRow,i:number)=>x.id!==batch[i]?.id||!['addition','unchanged','conflict'].includes(x.status)))throw Error('Invalid recovery preview');
   setReview({version:value.version,rows:value.rows,entries:batch});
  }catch(e){setNotice(e instanceof Error?e.message:'Preview failed');}finally{setBusy(false);}
 }
 async function restore(){
  if(!review)return;setBusy(true);setNotice('');
  const additions=review.entries.filter(x=>review.rows.some(row=>row.id===x.id&&row.status==='addition'));
  try{
   if(additions.length){const result=await request('restore',{version:review.version,entries:additions});if(result.count!==additions.length)throw Error('Unexpected recovery count');}
   const processed=review.rows.filter(x=>x.status!=='conflict').map(x=>x.id);setDone(old=>[...old,...processed]);
   setNotice('Recovered '+additions.length+' missing records. Existing differences were not changed.');setReview(null);setPage(0);onCommitted();
  }catch(e){setNotice(e instanceof Error?e.message:'Recovery failed');}finally{setBusy(false);}
 }
 return <section className="journal-editor" aria-label="Journal backup and recovery">
  <h2>Backup and recovery</h2><p>Download a consistent snapshot of active and removed records. Recovery preserves IDs, dates and revisions, and never replaces existing records.</p>
  <button className="secondary" disabled={busy} onClick={()=>void exportAll()}>Download full backup</button>
  <label>Choose Journal backup JSON<input type="file" accept=".json,application/json" disabled={busy} onChange={e=>void readFile(e)}/></label>
  {entries.length>0&&<>
   <p>{done.length} reviewed and recovered or already present · {remaining.length} remaining</p>
   <div className="journal-actions"><button className="secondary" disabled={busy||page===0} onClick={()=>{setPage(p=>p-1);setReview(null);}}>Previous batch</button>
    <button className="secondary" disabled={busy||(page+1)*50>=remaining.length} onClick={()=>{setPage(p=>p+1);setReview(null);}}>Next batch</button>
    <button className="primary" disabled={busy||!current.length} onClick={()=>void preview()}>Review recovery batch</button></div>
   {review&&<><div className="journal-import-preview">{review.rows.map(row=><p key={row.id}>{review.entries.find(x=>x.id===row.id)?.title} · {row.status}{row.reason?' · '+row.reason:''}</p>)}</div>
    <button className="primary" disabled={busy||review.rows.every(x=>x.status==='conflict')} onClick={()=>void restore()}>Confirm recovery of {review.rows.filter(x=>x.status==='addition').length} missing records</button></>}
  </>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
