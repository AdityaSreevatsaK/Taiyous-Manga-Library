import {useState,type ChangeEvent} from 'react';
import {IMPORT_COLUMNS,IMPORT_BATCH_LIMIT,parseCsv,suggestMapping,mapCsvRow,previewCandidates,normaliseImportTitle,type CsvRow,type Mapping,type ImportCandidate,type ImportPreviewRow} from '../domain/journalImport';
import {JOURNAL_STATUSES,type JournalRecord,type JournalStatus} from '../domain/journal';
import type {SheetData} from '../data/journalXlsx';
type Props={records:JournalRecord[];onCommitted:()=>void};
async function post(action:string,body:unknown){
 const res=await fetch('/api/journal/import/'+action,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Taiyou-Request':'journal'},body:JSON.stringify(body)});
 if(!res.ok)throw Error(res.status===409?'Journal changed. Preview again before committing.':res.status===401?'Sign in again.':res.status===503?'Import service unavailable or migration incomplete.':'Import request rejected.');
 return res.json();
}
export default function JournalCsvImport({records,onCommitted}:Props){
 const [headers,setHeaders]=useState<string[]>([]),[rows,setRows]=useState<CsvRow[]>([]),[mapping,setMapping]=useState<Mapping>({});
 const [sheets,setSheets]=useState<SheetData[]>([]),[sheetIndex,setSheetIndex]=useState(0);
 const [duplicateSelection,setDuplicateSelection]=useState<Record<string,string>>({});
 const [overrides,setOverrides]=useState<Record<number,JournalStatus>>({});
 const [page,setPage]=useState(0),[preview,setPreview]=useState<ImportPreviewRow[]|null>(null),[version,setVersion]=useState<number|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[selected,setSelected]=useState<number[]>([]);
 const [done,setDone]=useState<number[]>([]);
 const clear=()=>{setPreview(null);setVersion(null);setSelected([]);setNotice('');};
 async function readFile(event:ChangeEvent<HTMLInputElement>){
  clear();setHeaders([]);setRows([]);setDone([]);setPage(0);setSheets([]);setOverrides({});setSheetIndex(0);setDuplicateSelection({});
  const file=event.target.files?.[0];if(!file)return;
  setBusy(true);
  try{if(file.size>2*1024*1024)throw Error('Choose a workbook or CSV of at most 2 MB.');
   let parsed:SheetData[];
   if(file.name.toLowerCase().endsWith('.xlsx')){
    const {readJournalXlsx}=await import('../data/journalXlsx');parsed=await readJournalXlsx(await file.arrayBuffer());
   }else if(file.name.toLowerCase().endsWith('.csv'))parsed=[{name:'CSV',...parseCsv(await file.text())}];
   else throw Error('Choose XLSX or CSV.');
   setSheets(parsed);selectSheet(parsed,0);
  }catch(e){setNotice(e instanceof Error?e.message:'Could not read spreadsheet');}finally{setBusy(false);}
 }
 function selectSheet(values:SheetData[],index:number){
  const sheet=values[index];if(!sheet)return;
  clear();setSheetIndex(index);setHeaders(sheet.headers);setRows(sheet.rows);setMapping(suggestMapping(sheet.headers));
  setPage(0);setDone([]);setOverrides({});
 }
 const mapped=rows.map(row=>{
  const status=overrides[row.sourceRow],column=mapping.status;
  if(status&&column!==undefined){const cells=[...row.cells];cells[column]=status;return mapCsvRow({...row,cells},mapping,headers.length);}
  return mapCsvRow(row,mapping,headers.length);
 });
 // Detect duplicate titles across all spreadsheet rows, not just the active page.
 const candidates=mapped.filter(x=>x.fields).map(x=>({sourceRow:x.sourceRow,fields:x.fields!}));
 const local=previewCandidates(candidates,records);
 const byRow=new Map(local.map(x=>[x.sourceRow,x]));
 // Include unresolved and invalid rows in duplicate detection, across worksheets.
 const titleCounts=new Map<string,number>();
 for(const [i,sheet] of sheets.entries()){
  const col=i===sheetIndex?mapping.title:suggestMapping(sheet.headers).title;
  if(col===undefined)continue;
  for(const row of sheet.rows){const key=normaliseImportTitle(row.cells[col]??'');if(key)titleCounts.set(key,(titleCounts.get(key)??0)+1);}
 }
 const selectedRow=(row:number)=>sheetIndex+':'+row;
 const existingKeys=new Set(records.flatMap(r=>[r.title,...r.alternativeTitles].map(normaliseImportTitle)));
 function displayRow(x:ImportPreviewRow):ImportPreviewRow{
  const key=normaliseImportTitle(x.title),localRow=byRow.get(x.sourceRow)??x;
  if(!x.fields||!key||(titleCounts.get(key)??0)<2)return localRow;
  if(existingKeys.has(key))return {...x,status:'conflict',reason:'Possible existing entry; review manually'};
  if(duplicateSelection[key]!==selectedRow(x.sourceRow))return {...x,status:'conflict',reason:'Duplicate title in workbook; select one reviewed row'};
  // Do not bypass alias conflicts: only override the exact duplicate-title group.
  const otherAliases=new Set(x.fields.alternativeTitles.map(normaliseImportTitle));
  if(candidates.some(c=>c.sourceRow!==x.sourceRow&&[c.fields.title,...c.fields.alternativeTitles].some(a=>otherAliases.has(normaliseImportTitle(a)))))return localRow;
  return {...x,status:'addition'};
 }
 const current=mapped.slice(page*IMPORT_BATCH_LIMIT,(page+1)*IMPORT_BATCH_LIMIT).map(displayRow);
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
 return <section className="journal-editor" aria-label="Spreadsheet import">
  <h2>Import spreadsheet</h2><p>Map title and personal reading status. Review additions and conflicts; existing entries are never overwritten.</p>
  <label>Choose XLSX or CSV<input type="file" accept=".xlsx,.csv,text/csv" disabled={busy} onChange={e=>void readFile(e)}/></label>
  {sheets.length>1&&<label>Worksheet<select value={sheetIndex} disabled={busy} onChange={e=>selectSheet(sheets,Number(e.target.value))}>{sheets.map((sheet,i)=><option key={i} value={i}>{sheet.name} ({sheet.rows.length} rows)</option>)}</select></label>}
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
     {x.status==='conflict'&&x.reason?.includes('Duplicate title in workbook')&&<button type="button" className="secondary" disabled={busy}
       onClick={()=>{clear();setDuplicateSelection(old=>({...old,[normaliseImportTitle(x.title)]:selectedRow(x.sourceRow)}));}}>Retain reviewed row {x.sourceRow}</button>}
     {(x.status==='invalid'&&x.reason?.includes('reading status needs review')||!!overrides[x.sourceRow])&&mapping.status!==undefined&&<label>Resolve personal status for row {x.sourceRow}
       <select disabled={busy} value={overrides[x.sourceRow]??''} onChange={e=>{clear();setOverrides(old=>({...old,[x.sourceRow]:e.target.value as JournalStatus}));}}>
        <option value="">Needs review</option>{JOURNAL_STATUSES.map(s=><option key={s}>{s}</option>)}
       </select></label>}
   </div>)}</div>
   {preview&&<button type="button" className="primary" disabled={busy||!selected.length} onClick={()=>void commit()}>Confirm import of {selected.length} new entries</button>}
  </>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
