import {useState,type ChangeEvent} from 'react';
import {IMPORT_COLUMNS,IMPORT_BATCH_LIMIT,parseCsv,suggestMapping,mapCsvRow,previewCandidates,type CsvRow,type Mapping,type ImportCandidate,type ImportPreviewRow} from '../domain/journalImport';
import type {JournalRecord} from '../domain/journal';
type Props={records:JournalRecord[];onCommitted:()=>void};
async function post(action:string,body:unknown){
 const res=await fetch('/api/journal/import/'+action,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Taiyou-Request':'journal'},body:JSON.stringify(body)});
 if(!res.ok)throw Error(res.status===409?'Journal changed. Preview again before committing.':res.status===401?'Sign in again.':res.status===503?'Import service unavailable or migration incomplete.':'Import request rejected.');
 return res.json();
}
export default function JournalCsvImport({records,onCommitted}:Props){
 const [headers,setHeaders]=useState<string[]>([]),[rows,setRows]=useState<CsvRow[]>([]),[mapping,setMapping]=useState<Mapping>({});
 const [page,setPage]=useState(0),[preview,setPreview]=useState<ImportPreviewRow[]|null>(null),[version,setVersion]=useState<number|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[selected,setSelected]=useState<number[]>([]);
 const [done,setDone]=useState<number[]>([]);
 const clear=()=>{setPreview(null);setVersion(null);setSelected([]);setNotice('');};
 async function readFile(event:ChangeEvent<HTMLInputElement>){
  clear();setHeaders([]);setRows([]);setDone([]);setPage(0);
  const file=event.target.files?.[0];if(!file)return;
  try{if(file.size>2*1024*1024||!file.name.toLowerCase().endsWith('.csv'))throw Error('Choose a CSV file of at most 2 MB.');
   const parsed=parseCsv(await file.text());setHeaders(parsed.headers);setRows(parsed.rows);setMapping(suggestMapping(parsed.headers));}
  catch(e){setNotice(e instanceof Error?e.message:'Could not read CSV');}
 }
 const mapped=rows.map(row=>mapCsvRow(row,mapping,headers.length));
 // Detect duplicate titles across all spreadsheet rows, not just the active page.
 const candidates=mapped.filter(x=>x.fields).map(x=>({sourceRow:x.sourceRow,fields:x.fields!}));
 const local=previewCandidates(candidates,records);
 const byRow=new Map(local.map(x=>[x.sourceRow,x]));
 const current=mapped.slice(page*IMPORT_BATCH_LIMIT,(page+1)*IMPORT_BATCH_LIMIT).map(x=>byRow.get(x.sourceRow)??x);
 const eligible=current.filter(x=>x.status==='addition'&&!done.includes(x.sourceRow));
 async function doPreview(){
  setBusy(true);clear();
  try{const body=eligible.map(x=>({sourceRow:x.sourceRow,fields:x.fields!}));
   if(!body.length){setNotice('No new valid rows in this batch.');return;}
   const response=await post('preview',{rows:body}) as {version:number;rows:ImportPreviewRow[]};
   if(!Number.isSafeInteger(response.version)||!Array.isArray(response.rows))throw Error('Invalid preview response');
   const result=new Map(response.rows.map(x=>[x.sourceRow,x]));
   const next=current.map(x=>result.get(x.sourceRow)??x);
   setVersion(response.version);setPreview(next);setSelected(response.rows.filter(x=>x.status==='addition').map(x=>x.sourceRow));
  }catch(e){setNotice(e instanceof Error?e.message:'Preview failed');}finally{setBusy(false);}
 }
 async function commit(){
  if(version===null||!preview||!selected.length)return;
  const rows:ImportCandidate[]=preview.filter(x=>selected.includes(x.sourceRow)&&x.status==='addition'&&x.fields).map(x=>({sourceRow:x.sourceRow,fields:x.fields!}));
  setBusy(true);
  try{const result=await post('commit',{version,rows}) as {count:number};
   if(result.count!==rows.length)throw Error('Unexpected import result. Refresh before retrying.');
   setDone(prev=>[...prev,...rows.map(x=>x.sourceRow)]);setPreview(null);setVersion(null);setSelected([]);
   setNotice('Imported '+result.count+' new entries.');onCommitted();}
  catch(e){setNotice(e instanceof Error?e.message:'Commit failed');}finally{setBusy(false);}
 }
 return <section className="journal-editor" aria-label="CSV import">
  <h2>Import CSV</h2><p>Map title and personal reading status. Review additions and conflicts; existing entries are never overwritten. XLSX support is pending.</p>
  <label>Choose CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>void readFile(e)}/></label>
  {headers.length>0&&<>
   {IMPORT_COLUMNS.map(key=><label key={key}>{key}<select disabled={busy} value={mapping[key]??''} onChange={e=>{clear();setMapping(prev=>({...prev,[key]:e.target.value===''?undefined:Number(e.target.value)}));}}>
    <option value="">Not mapped</option>{headers.map((h,i)=><option value={i} key={i}>{h} (column {i+1})</option>)}</select></label>)}
   <div className="journal-actions"><button type="button" className="secondary" disabled={busy||page===0} onClick={()=>{clear();setPage(n=>n-1);}}>Previous batch</button>
    <span>Batch {page+1} of {Math.max(1,Math.ceil(rows.length/IMPORT_BATCH_LIMIT))}</span>
    <button type="button" className="secondary" disabled={busy||(page+1)*IMPORT_BATCH_LIMIT>=rows.length} onClick={()=>{clear();setPage(n=>n+1);}}>Next batch</button>
    <button type="button" className="primary" disabled={busy||!eligible.length} onClick={()=>void doPreview()}>Review against Journal</button></div>
   <div className="journal-import-preview">{(preview??current).map(x=><div key={x.sourceRow} className="journal-import-row">
    <label className="journal-check">{preview&&x.status==='addition'&&!done.includes(x.sourceRow)&&<input type="checkbox" disabled={busy} checked={selected.includes(x.sourceRow)} onChange={e=>setSelected(old=>e.target.checked?[...old,x.sourceRow]:old.filter(n=>n!==x.sourceRow))}/>}
     Row {x.sourceRow}: {x.title||'(blank title)'} · {done.includes(x.sourceRow)?'Imported':x.status}{x.reason?' · '+x.reason:''}</label>
   </div>)}</div>
   {preview&&<button type="button" className="primary" disabled={busy||!selected.length} onClick={()=>void commit()}>Confirm import of {selected.length} new entries</button>}
  </>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
