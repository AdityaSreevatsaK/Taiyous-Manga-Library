import {useState} from 'react';
import type {MangaEntry} from '../domain/types';
import {PencilIcon} from './SharedLibraryIcons';

/** An explicitly personal synopsis layer. The source catalogue on Hugging Face
 * stays immutable and never receives browser credentials or unreviewed writes. */
const KEY='taiyou-manga:personal-synopsis:v1:';
const LIMIT=2000;
function readSynopsis(id:string):string|null{
  try{
    const value=localStorage.getItem(KEY+id);
    return value!==null&&value.length<=LIMIT?value:null;
  }catch{return null;}
}

export function MangaSynopsisCard({entry}:{entry:MangaEntry}){
  const [override,setOverride]=useState<string|null>(()=>readSynopsis(entry.id));
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(override??entry.synopsis??'');
  const [message,setMessage]=useState('');
  function save(){
    const value=draft.trim();
    if(value.length>LIMIT){
      setMessage('Synopsis must be no longer than 2,000 characters.');return;
    }
    try{
      if(value===entry.synopsis||!value){
        localStorage.removeItem(KEY+entry.id);
        setOverride(null);
      }else{
        localStorage.setItem(KEY+entry.id,value);
        setOverride(value);
      }
      setEditing(false);
      setMessage('Personal synopsis saved on this device.');
    }catch{
      setMessage('Browser storage is unavailable. Your draft has not been discarded.');
    }
  }
  function reset(){
    try{
      localStorage.removeItem(KEY+entry.id);
      setOverride(null);setDraft(entry.synopsis??'');
      setEditing(false);setMessage('Showing the original synopsis again.');
    }catch{setMessage('Browser storage is unavailable. The original was not restored.');}
  }
  return <section className="manga-detail-card manga-synopsis-card">
    <div className="manga-synopsis-heading details-section-header">
      <div><p className="manga-card-overline">ABOUT THE STORY</p><h2>Synopsis</h2></div>
      <button type="button" className="manga-synopsis-edit details-text-action"
        aria-expanded={editing} onClick={()=>{
          if(editing){setEditing(false);setMessage('');}
          else{setDraft(override??entry.synopsis??'');setEditing(true);setMessage('');}
        }}><PencilIcon size={15}/>{editing?'Cancel':'Edit summary'}</button>
    </div>
    {editing?<>
      <label htmlFor="manga-synopsis-draft" className="manga-synopsis-label">
        Personal synopsis, saved on this device
      </label>
      <textarea id="manga-synopsis-draft" value={draft} maxLength={LIMIT} rows={6}
        onChange={event=>setDraft(event.target.value)}
        placeholder="Write a description of this manga…"/>
      <div className="manga-synopsis-actions">
        <span>{draft.length} / {LIMIT}</span>
        <button type="button" className="primary" onClick={save}
          disabled={draft.trim()===(override??entry.synopsis??'').trim()}>Save synopsis</button>
        {override!==null&&<button type="button" className="secondary"
          onClick={reset}>Restore original</button>}
      </div>
      <p className="manga-synopsis-hint">This is a personal edit. It does not modify the Hugging Face dataset.</p>
    </>:<>
      <p className="detail-description" role="region" aria-label="Manga synopsis text" tabIndex={0}>{override??entry.synopsis??'A synopsis has not been added yet.'}</p>
      {override!==null&&<p className="manga-synopsis-hint">Personal version, stored on this device.
        <button type="button" onClick={reset}>Restore original</button></p>}
    </>}
    {message&&<p className="manga-synopsis-message" role="status">{message}</p>}
  </section>;
}
