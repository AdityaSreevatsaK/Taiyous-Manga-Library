import {useEffect,useState} from 'react';
import type {MangaEntry,MangaProgress} from '../domain/types';
import {canonicalTags,type AnnotationPatch,type PersonalAnnotation} from '../domain/personalAnnotations';
import type {PersonalShelf,ShelfSelection} from '../domain/personalShelves';
import {recordMangaAction} from '../domain/usageAnalytics';

interface Props{
 entry:MangaEntry;annotation?:PersonalAnnotation;progress?:MangaProgress;
 shelf?:PersonalShelf;
 onSaveAnnotation:(entry:MangaEntry,patch:AnnotationPatch,message:string)=>boolean;
 onSetShelf:(entry:MangaEntry,shelf:ShelfSelection)=>void;
 onResetProgress:(entry:MangaEntry)=>boolean;
 onSaveSynopsis:(entry:MangaEntry,value:string)=>boolean;
}
const SYNOPSIS='taiyou-manga:personal-synopsis:v1:';
function currentSynopsis(entry:MangaEntry):string{
 try{return localStorage.getItem(SYNOPSIS+entry.id)??entry.synopsis??'';}
 catch{return entry.synopsis??'';}
}
export function MangaMasterRecordEditor({entry,annotation,progress,shelf,
 onSaveAnnotation,onSetShelf,onResetProgress,onSaveSynopsis}:Props){
 const [rating,setRating]=useState(annotation?.rating??null);
 const [notes,setNotes]=useState(annotation?.notes??'');
 const [tags,setTags]=useState((annotation?.tags??[]).join(', '));
 const [synopsis,setSynopsis]=useState(()=>currentSynopsis(entry));
 const [selectedShelf,setSelectedShelf]=useState<ShelfSelection>(shelf??null);
 const [confirmReset,setConfirmReset]=useState(false);
 const [resetText,setResetText]=useState('');
 const [confirmFinished,setConfirmFinished]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 useEffect(()=>{setRating(annotation?.rating??null);setNotes(annotation?.notes??'');
   setTags((annotation?.tags??[]).join(', '));setSynopsis(currentSynopsis(entry));
   setSelectedShelf(shelf??null);setConfirmReset(false);setResetText('');setConfirmFinished(false);
   setError('');setSuccess('');
 },[entry.id]);
 const run=(label:string,action:()=>boolean)=>{
   setError('');setSuccess('');
   if(action())setSuccess(label);else setError('Change could not be saved; the original record remains untouched.');
 };
 const markFinished=()=>{
   onSetShelf(entry,'finished');setSelectedShelf('finished');setConfirmFinished(false);
   recordMangaAction({kind:'shelf-changed',mangaId:entry.id,detail:'Finished'});
   setSuccess('Moved to your Finished shelf. Publication status is unchanged.');
 };
 return <div className="manga-master-editor" aria-label={'Edit personal record for '+entry.title}>
   <div className="manga-master-editor-grid">
     <section className="manga-master-field">
       <h3>Rating and notes</h3>
       <label htmlFor={'manga-master-rating-'+entry.id}>Personal rating</label>
       <select id={'manga-master-rating-'+entry.id} value={rating??''}
         onChange={e=>setRating(e.target.value===''?null:Number(e.target.value))}>
         <option value="">Not rated</option>
         {Array.from({length:10},(_,i)=>i+1).map(v=><option key={v} value={v}>{v}/10</option>)}
       </select>
       <label htmlFor={'manga-master-notes-'+entry.id}>Private notes</label>
       <textarea id={'manga-master-notes-'+entry.id} value={notes} maxLength={5000} rows={4}
         onChange={e=>setNotes(e.target.value)}/>
       <button type="button" onClick={()=>run('Rating and notes saved',()=>
         onSaveAnnotation(entry,{rating,notes},'Rating and notes saved'))}>Save rating and notes</button>
     </section>
     <section className="manga-master-field">
       <h3>Personal tags</h3>
       <p>Source genres are read-only: {entry.tags.join(', ')||'None'}</p>
       <label htmlFor={'manga-master-tags-'+entry.id}>Personal tags, separated by commas</label>
       <textarea id={'manga-master-tags-'+entry.id} value={tags} maxLength={3000} rows={4}
         onChange={e=>setTags(e.target.value)}/>
       <button type="button" onClick={()=>{
         try{
           const values=canonicalTags(tags.split(',').map(t=>t.trim()).filter(Boolean));
           run('Personal tags saved',()=>onSaveAnnotation(entry,{tags:values},'Personal tags saved'));
         }catch(e){setError(e instanceof Error?e.message:'Invalid personal tags');}
       }}>Save tags</button>
     </section>
     <section className="manga-master-field">
       <h3>Personal synopsis</h3>
       <p>The imported synopsis remains intact. This override is stored on this device.</p>
       <label htmlFor={'manga-master-synopsis-'+entry.id}>Personal summary</label>
       <textarea id={'manga-master-synopsis-'+entry.id} value={synopsis} maxLength={2000} rows={5}
         onChange={e=>setSynopsis(e.target.value)}/>
       <div className="manga-master-field-buttons">
         <button type="button" onClick={()=>run('Personal synopsis saved',()=>onSaveSynopsis(entry,synopsis))}>Save synopsis</button>
         <button type="button" onClick={()=>{setSynopsis(entry.synopsis??'');
           run('Original synopsis restored',()=>onSaveSynopsis(entry,''));}}>Restore original</button>
       </div>
     </section>
     <section className="manga-master-field">
       <h3>Personal reading shelf</h3>
       <p>Choose your personal reading state, independently from the manga's publication status.</p>
       <label htmlFor={'manga-master-shelf-'+entry.id}>Shelf</label>
       <select id={'manga-master-shelf-'+entry.id} value={selectedShelf??''}
         onChange={e=>setSelectedShelf((e.target.value||null) as ShelfSelection)}>
         <option value="">Currently Reading / Not started</option>
         <option value="trying">Trying Out</option>
         <option value="to-read">To Be Read</option>
         <option value="finished">Finished</option>
       </select>
       <button type="button" onClick={()=>{onSetShelf(entry,selectedShelf);
         setSuccess('Personal shelf updated. Publication status is unchanged.');}}>Save shelf</button>
     </section>
   </div>
   <section className="manga-master-progress">
     <div><h3>Reading progress</h3>
       <p>{progress?entry.chapters.find(ch=>ch.id===progress.chapterId)?.label??'Saved chapter':'Not started'}
         {progress?' · Page '+(progress.pageIndex+1):''}</p>
     </div>
     {!confirmFinished?<button type="button" disabled={shelf==='finished'}
       onClick={()=>setConfirmFinished(true)}>Mark personally finished</button>:
       <div className="manga-master-confirm" role="group" aria-label="Confirm mark finished">
         <p>Mark this manga as personally finished? This does not change its publication status.</p>
         <button type="button" onClick={markFinished}>Confirm finished</button>
         <button type="button" onClick={()=>setConfirmFinished(false)}>Cancel</button>
       </div>}
     {!confirmReset?<button type="button" className="manga-master-danger" disabled={!progress}
       onClick={()=>setConfirmReset(true)}>Reset reading progress</button>:
       <div className="manga-master-confirm" role="group" aria-label="Confirm progress reset">
         <p>Reset only this manga's saved page and chapter position? Notes and ratings are preserved.</p>
         <label htmlFor={'manga-reset-confirm-'+entry.id}>Type RESET PROGRESS to continue</label>
         <input id={'manga-reset-confirm-'+entry.id} value={resetText}
           onChange={e=>setResetText(e.target.value)} autoComplete="off"/>
         <button type="button" disabled={resetText!=='RESET PROGRESS'} onClick={()=>{
           run('Reading progress reset',()=>onResetProgress(entry));setResetText('');setConfirmReset(false);
         }}>Reset progress</button>
         <button type="button" onClick={()=>{setResetText('');setConfirmReset(false);}}>Cancel</button>
       </div>}
   </section>
   {error&&<p role="alert" className="manga-master-edit-error">{error}</p>}
   {success&&<p role="status" className="manga-master-edit-success">{success}</p>}
 </div>;
}
