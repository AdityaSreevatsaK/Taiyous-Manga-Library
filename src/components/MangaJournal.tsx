import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {JOURNAL_STATUSES,JOURNAL_TYPES,parseJournalFields,journalFields,type JournalFields,type JournalRecord} from '../domain/journal';
import {JournalError,loadJournal,saveJournal,setJournalDeleted} from '../data/journalGateway';
import type {MangaEntry} from '../domain/types';
import './manga-journal.css';
type Props={archiveEntries?:readonly MangaEntry[];hrefFor:(id:string)=>string};
type Draft={record?:JournalRecord;fields:JournalFields};
const empty=()=>parseJournalFields({title:'New entry',status:'Plan to Read'});
const num=(value:string)=>value===''?null:Number(value);
const lines=(value:string)=>value.split('\n').map(s=>s.trim()).filter(Boolean);
function download(name:string,content:string,type:string){
 const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function MangaJournal({archiveEntries,hrefFor}:Props){
 const [records,setRecords]=useState<JournalRecord[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[unauthorised,setUnauthorised]=useState(false);
 const [refresh,setRefresh]=useState(0),[deleted,setDeleted]=useState(false);
 const [search,setSearch]=useState(''),[status,setStatus]=useState('all'),[rating,setRating]=useState('all');
 const [type,setType]=useState('all'),[favourite,setFavourite]=useState(false),[archived,setArchived]=useState('all'),[sort,setSort]=useState('title');
 const [draft,setDraft]=useState<Draft|null>(null),[confirm,setConfirm]=useState<JournalRecord|null>(null);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');setRecords([]);setUnauthorised(false);
  void loadJournal(deleted,controller.signal).then(value=>{if(!controller.signal.aborted)setRecords(value);})
   .catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Journal unavailable');setUnauthorised(e instanceof JournalError&&e.status===401);}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[deleted,refresh]);
 const archiveIds=useMemo(()=>new Set(archiveEntries?.map(x=>x.id)),[archiveEntries]);
 const isArchived=(r:JournalRecord)=>!!r.libraryMangaId&&archiveIds.has(r.libraryMangaId);
 const filtered=records.filter(r=>(status==='all'||r.status===status)&&(rating==='all'||(rating==='none'?r.rating===null:r.rating===Number(rating)))&&
  (type==='all'||r.type===type)&&(!favourite||r.favourite)&&
  (archived==='all'||(archiveEntries!==undefined&&(archived==='yes'?isArchived(r):!isArchived(r))))&&
  [r.title,...r.alternativeTitles,...r.authors,...r.artists,...r.tags].some(x=>x.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())))
  .sort((a,b)=>sort==='rating'?(b.rating??0)-(a.rating??0)||a.title.localeCompare(b.title):sort==='updated'?b.updatedAt.localeCompare(a.updatedAt):a.title.localeCompare(b.title));
 function change<K extends keyof JournalFields>(key:K,value:JournalFields[K]){setDraft(d=>d?{...d,fields:{...d.fields,[key]:value}}:null);}
 async function save(event:FormEvent){
  event.preventDefault();if(!draft||busy)return;setBusy(true);setError('');
  try{const fields=parseJournalFields(draft.fields);await saveJournal(fields,draft.record);setDraft(null);setRefresh(n=>n+1);}
  catch(e){if(e instanceof JournalError&&e.status===401){setRecords([]);setDraft(null);setUnauthorised(true);}setError(e instanceof Error?e.message:'Save failed');}
  finally{setBusy(false);}
 }
 async function remove(record:JournalRecord){
  setBusy(true);setError('');try{await setJournalDeleted(record,!deleted);setConfirm(null);setRefresh(n=>n+1);}
  catch(e){if(e instanceof JournalError&&e.status===401){setRecords([]);setConfirm(null);setUnauthorised(true);}setError(e instanceof Error?e.message:'Change failed');}
  finally{setBusy(false);}
 }
 function exportData(csv:boolean){
  if(!csv){download('manga-journal.json',JSON.stringify({schemaVersion:1,entries:records},null,2),'application/json');return;}
  const keys=['title','status','type','authors','artists','alternativeTitles','tags','totalChapters','chaptersRead','rating','favourite','startedOn','finishedOn','notes','readingLinks','externalIds','libraryMangaId','id','revision','createdAt','updatedAt','deletedAt'] as const;
  const cell=(v:unknown)=>{let s=v===null?'':typeof v==='object'?JSON.stringify(v):String(v);
   if(/^[\s\uFEFF]*[=+\-@]/u.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  download('manga-journal.csv',[keys.join(','),...records.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n'),'text/csv;charset=utf-8');
 }
 return <section className="journal-page" aria-labelledby="journal-heading">
  <p className="eyebrow">PRIVATE READING HISTORY</p><h1 id="journal-heading">Manga Reading Journal</h1>
  <p>Your reading history, independent of the manga archived in your Library.</p>
  {loading&&<p role="status">Loading private Journal…</p>}
  {error&&<p role="alert">{error}</p>}
  {unauthorised&&<a className="secondary" href="/api/auth/login">Sign in with Hugging Face</a>}
  <div className="journal-actions">
   <button className="secondary" disabled={loading||busy} onClick={()=>{setDraft(null);setConfirm(null);setRefresh(n=>n+1);}}>Refresh</button>
   <button className="secondary" disabled={busy||loading||unauthorised} onClick={()=>{setDraft(null);setConfirm(null);setDeleted(v=>!v);}}>{deleted?'Active entries':'Recently removed'}</button>
   <button className="primary" disabled={busy||loading||!!error||deleted} onClick={()=>setDraft({fields:{...empty(),title:''}})}>Add manga</button>
   <button className="secondary" disabled={loading||!!error||busy} onClick={()=>exportData(false)}>Export JSON</button>
   <button className="secondary" disabled={loading||!!error||busy} onClick={()=>exportData(true)}>Export CSV</button>
  </div>
  {!loading&&!unauthorised&&records.length>0&&<p aria-label="Journal status counts">{records.length} entries · {JOURNAL_STATUSES.map(s=>s+': '+records.filter(r=>r.status===s).length).join(' · ')}</p>}
  {draft&&<form className="journal-editor" onSubmit={save}>
   <h2>{draft.record?'Edit entry':'Add manga'}</h2>
   <label>Title<input required maxLength={240} value={draft.fields.title} onChange={e=>change('title',e.target.value)}/></label>
   <label>Reading status<select value={draft.fields.status} onChange={e=>change('status',e.target.value as JournalFields['status'])}>{JOURNAL_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label>
   <label>Type<select value={draft.fields.type??''} onChange={e=>change('type',(e.target.value||null) as JournalFields['type'])}><option value="">Unknown</option>{JOURNAL_TYPES.map(s=><option key={s}>{s}</option>)}</select></label>
   {(['alternativeTitles','authors','artists','tags','readingLinks'] as const).map(k=><label key={k}>{({alternativeTitles:'Alternative titles',authors:'Authors',artists:'Artists',tags:'Genres / tags',readingLinks:'HTTPS reading links'})[k]} (one per line)
    <textarea key={draft.record?.id??'new'} defaultValue={draft.fields[k].join('\n')} onChange={e=>change(k,lines(e.target.value))}/></label>)}
   {(['totalChapters','chaptersRead','rating'] as const).map(k=><label key={k}>{({totalChapters:'Total chapters',chaptersRead:'Chapters read',rating:'My rating (1–10)'})[k]}
    <input type="number" step={1} min={k==='rating'?1:0} max={k==='rating'?10:1000000} value={draft.fields[k]??''} onChange={e=>change(k,num(e.target.value))}/></label>)}
   {(['startedOn','finishedOn'] as const).map(k=><label key={k}>{k==='startedOn'?'Started on':'Finished on'}<input type="date" value={draft.fields[k]??''} onChange={e=>change(k,e.target.value||null)}/></label>)}
   <label>Personal notes<textarea maxLength={5000} value={draft.fields.notes??''} onChange={e=>change('notes',e.target.value||null)}/></label>
   <label className="journal-check"><input type="checkbox" checked={draft.fields.favourite} onChange={e=>change('favourite',e.target.checked)}/>Favourite</label>
   {archiveEntries!==undefined&&<label>Linked archive<select value={draft.fields.libraryMangaId??''} onChange={e=>change('libraryMangaId',e.target.value||null)}>
    <option value="">No link</option>{draft.fields.libraryMangaId&&!archiveIds.has(draft.fields.libraryMangaId)&&<option value={draft.fields.libraryMangaId}>Previously linked (not in current catalogue)</option>}
    {archiveEntries.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
   <div className="journal-actions"><button className="primary" disabled={busy} type="submit">Save entry</button><button className="secondary" disabled={busy} type="button" onClick={()=>setDraft(null)}>Cancel</button></div>
  </form>}
  {confirm&&<div className="journal-editor" role="group" aria-label="Confirm Journal change"><p>{deleted?'Restore':'Remove'} {confirm.title}? {deleted?'The record will return to active entries.':'The record can be recovered. Archived manga and local records remain unchanged.'}</p>
   <div className="journal-actions"><button className="primary" disabled={busy} onClick={()=>void remove(confirm)}>Confirm {deleted?'restore':'removal'}</button><button className="secondary" disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button></div></div>}
  {!loading&&!unauthorised&&<><div className="journal-filters">
   <label>Search Journal<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All</option>{JOURNAL_STATUSES.map(s=><option key={s}>{s}</option>)}</select></label>
   <label>Rating<select value={rating} onChange={e=>setRating(e.target.value)}><option value="all">All</option><option value="none">Unrated</option>{Array.from({length:10},(_,i)=>i+1).map(n=><option key={n}>{n}</option>)}</select></label>
   <label>Type<select value={type} onChange={e=>setType(e.target.value)}><option value="all">All</option>{JOURNAL_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
   <label>Archive<select disabled={archiveEntries===undefined} value={archived} onChange={e=>setArchived(e.target.value)}><option value="all">All</option><option value="yes">Archived</option><option value="no">Not archived</option></select></label>
   <label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}><option value="title">Title</option><option value="rating">Rating</option><option value="updated">Recently updated</option></select></label>
   <label className="journal-check"><input type="checkbox" checked={favourite} onChange={e=>setFavourite(e.target.checked)}/>Favourites only</label>
  </div>
  {!filtered.length&&!error&&<p role="status">{records.length?'No matching entries.':deleted?'No removed entries.':'No entries yet. Add your first manga.'}</p>}
  {filtered.length>0&&<table className="journal-table"><thead><tr>{['Manga','Reading status','Chapters','Rating','Archive','Actions'].map(s=><th scope="col" key={s}>{s}</th>)}</tr></thead><tbody>
   {filtered.map(record=><tr key={record.id}>
    <td data-label="Manga"><strong>{record.title}</strong>{record.favourite&&<span> · Favourite</span>}<div>{record.authors.join(', ')||'Author unknown'}</div><small>{record.type??'Unknown type'}</small></td>
    <td data-label="Reading status">{record.status}</td><td data-label="Chapters">{record.chaptersRead??'?'}/{record.totalChapters??'?'}</td>
    <td data-label="Rating">{record.rating===null?'Unrated':record.rating+'/10'}</td>
    <td data-label="Archive">{isArchived(record)?<a href={hrefFor(record.libraryMangaId!)}>Read in My Library</a>:archiveEntries===undefined?'Availability unknown':'Not archived'}</td>
    <td data-label="Actions"><div className="journal-actions">{!deleted&&<button className="secondary" disabled={busy} onClick={()=>setDraft({record,fields:journalFields(record)})}>Edit</button>}
     <button className="secondary" disabled={busy} onClick={()=>setConfirm(record)}>{deleted?'Restore':'Remove'}</button></div></td>
   </tr>)}
  </tbody></table>}
  </>}
 </section>;
}
