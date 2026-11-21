import {useEffect,useMemo,useState,type FormEvent,type ReactNode} from 'react';
import type {MangaChapter} from '../domain/types';
import {BookMarkedIcon,ListIcon,SearchIcon} from './SharedLibraryIcons';

/**
 * Port of Novel Library src/components/ChapterBrowser.tsx, with only the
 * chapter data and callback adapted for immutable manga IDs and images.
 * Keep source markup, pagination controls and accessibility semantics.
 */
const CHAPTERS_PER_PAGE=50;
interface Props {
 chapters:readonly MangaChapter[];
 mangaId:string;
 currentChapterId?:string;
 busy:boolean;
 onReadChapter:(chapterId:string)=>void;
 completedChapterIds:readonly string[];
 renderOfflineControl?:(chapter:MangaChapter)=>ReactNode;
 onToggleComplete:(chapterId:string)=>void;
}
export function MangaChapterBrowser({chapters,mangaId,currentChapterId,busy,
 onReadChapter,completedChapterIds,onToggleComplete,renderOfflineControl}:Props){
 const [search,setSearch]=useState('');
 const [chapterNumber,setChapterNumber]=useState('');
 const [page,setPage]=useState(0);
 const [invalidNumber,setInvalidNumber]=useState(false);
 useEffect(()=>{
  setSearch('');setChapterNumber('');setPage(0);setInvalidNumber(false);
 },[mangaId]);
 const filtered=useMemo(()=>{
  const term=search.trim().toLocaleLowerCase();
  return chapters.flatMap((chapter,index)=>{
   const number=index+1;
   return term&&!chapter.label.toLocaleLowerCase().includes(term)&&
      String(number)!==term&&'chapter '+number!==term
    ?[]:[{...chapter,number}];
  });
 },[chapters,search]);
 const pageCount=Math.max(1,Math.ceil(filtered.length/CHAPTERS_PER_PAGE));
 const shown=filtered.slice(page*CHAPTERS_PER_PAGE,(page+1)*CHAPTERS_PER_PAGE);
 const currentNumber=chapters.findIndex(ch=>ch.id===currentChapterId)+1;
 function goToNumber(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const raw=chapterNumber.trim();
  const n=Number(raw);
  const valid=/^\d+$/.test(raw)&&Number.isSafeInteger(n)&&n>0&&n<=chapters.length;
  setInvalidNumber(!valid);
  if(valid)onReadChapter(chapters[n-1]!.id);
 }
 function showCurrent(){
  if(currentNumber<1||currentNumber>chapters.length)return;
  setSearch('');setPage(Math.floor((currentNumber-1)/CHAPTERS_PER_PAGE));
 }
 return <section className="manga-detail-card chapter-section chapter-browser novel-chapter-browser"
  aria-labelledby="detail-chapters-heading">
  <div className="details-section-header">
   <div><span className="details-label">PICK UP ANYWHERE</span>
    <h2 id="detail-chapters-heading">Chapters</h2></div>
   <ListIcon size={21} className="details-section-icon"/>
  </div>
  <div className="chapter-topline">
   <strong>{chapters.length.toLocaleString()} chapters available</strong>
   {currentNumber>0&&currentNumber<=chapters.length&&
    <button type="button" className="chapter-current-link" onClick={showCurrent}
      title={'Show chapter '+currentNumber+' in the list'}
      aria-label={'Show my last chapter ('+currentNumber+')'}>
      <BookMarkedIcon size={15}/><span>Show my last chapter ({currentNumber})</span>
    </button>}
  </div>
  <div className="chapter-tools">
   <label className="chapter-search"><SearchIcon size={15}/>
    <span className="manga-sr-only">Search chapters</span>
    <input type="search" placeholder="Search chapter titles or numbers" value={search}
      onChange={event=>{setSearch(event.target.value);setPage(0);}}/>
   </label>
   <form className="chapter-jump" onSubmit={goToNumber}>
    <label htmlFor="chapter-number-jump">Go to</label>
    <input id="chapter-number-jump" type="number" min={1} max={chapters.length}
      placeholder="#" value={chapterNumber}
      onChange={event=>{setChapterNumber(event.target.value);setInvalidNumber(false);}}
      aria-invalid={invalidNumber}/>
    <button type="submit" disabled={!chapterNumber.trim()||busy}>Open →</button>
   </form>
  </div>
  {invalidNumber&&<p className="chapter-validation" role="alert">
   Enter a chapter number between 1 and {chapters.length.toLocaleString()}.
  </p>}
  <div className="chapter-list" role="list" aria-label="Available chapters">
   {shown.map(item=><div role="listitem" key={item.id}>
    <button type="button" disabled={busy}
      className={'chapter-list-item'+(item.number===currentNumber?' chapter-list-current':'')}
      onClick={()=>onReadChapter(item.id)} title={'Read chapter '+item.number+': '+item.label}>
      <span className="chapter-list-index">{item.number}</span>
      <span className="chapter-list-label">{item.label}</span>
      {item.number===currentNumber&&<span className="chapter-list-badge">Last read</span>}
      <span className="chapter-list-arrow" aria-hidden="true">→</span>
    </button>
   </div>)}
   {!filtered.length&&<div className="chapter-no-results">No chapters match your search.</div>}
  </div>
  {filtered.length>CHAPTERS_PER_PAGE&&<nav className="chapter-paging" aria-label="Chapter list pages">
    <div className="chapter-page-actions">
      <button type="button" disabled={page===0} onClick={()=>setPage(0)}>First</button>
      <button type="button" disabled={page===0}
        onClick={()=>setPage(p=>Math.max(0,p-1))}>‹ Previous</button>
    </div>
    <span>Showing {(page*CHAPTERS_PER_PAGE+1).toLocaleString()}–
      {Math.min(filtered.length,(page+1)*CHAPTERS_PER_PAGE).toLocaleString()} of {filtered.length.toLocaleString()}</span>
    <div className="chapter-page-actions">
      <button type="button" disabled={page>=pageCount-1}
        onClick={()=>setPage(p=>Math.min(pageCount-1,p+1))}>Next ›</button>
      <button type="button" disabled={page>=pageCount-1}
        onClick={()=>setPage(pageCount-1)}>Last page ›</button>
    </div>
  </nav>}
  {/* Only synthetic sample chapters support offline storage. Keep those actions
      visible in a separate compact section, not alongside every chapter link. */}
  {renderOfflineControl&&<section className="manga-sample-offline-controls" aria-label="Offline sample chapters">
    <h3>Offline sample chapters</h3>
    {chapters.map((chapter,index)=><div key={chapter.id} className="manga-offline-sample-row">
      <span>Chapter {index+1}</span>
      {renderOfflineControl(chapter)}
    </div>)}
  </section>}
  {/* Preserve Manga's explicit completion feature without 50 prominent row buttons. */}
  {chapters.length>0&&<details className="manga-chapter-completion" open={!!renderOfflineControl}>
    <summary>Manage completed chapters</summary>
    <p>{completedChapterIds.length} of {chapters.length} chapters explicitly marked completed.</p>
    <div className="manga-completion-grid">
    {shown.map(item=><label key={item.id}>
      <input type="checkbox" checked={completedChapterIds.includes(item.id)}
        onChange={()=>onToggleComplete(item.id)}/>
      Chapter {item.number}
    </label>)}
    </div>
  </details>}
  {busy&&<p role="status" className="chapter-loading-note">
   Verifying chapter pages from your private library…</p>}
 </section>;
}
