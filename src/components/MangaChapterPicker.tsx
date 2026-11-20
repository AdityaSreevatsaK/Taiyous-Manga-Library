import {useEffect,useMemo,useRef,useState} from 'react';
import type {MangaChapter} from '../domain/types';

interface Props {
  open:boolean;
  chapters:readonly MangaChapter[];
  currentChapterId:string;
  disabled?:boolean;
  onClose:()=>void;
  onSelect:(chapterId:string)=>void;
}
const ROW=50;
const WINDOW=48;

/** Match the Novel Library's accessible, searchable and virtualised chapter
 * dialog. No native 200-plus-option dropdown; only nearby rows are mounted. */
export function MangaChapterPicker({open,chapters,currentChapterId,disabled,onClose,onSelect}:Props){
  const [search,setSearch]=useState('');
  const [scrollIndex,setScrollIndex]=useState(0);
  const input=useRef<HTMLInputElement>(null);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  const list=useRef<HTMLDivElement>(null);
  const current=chapters.findIndex(ch=>ch.id===currentChapterId);
  const matches=useMemo(()=>{
    const query=search.trim().toLowerCase();
    return chapters.map((chapter,index)=>({chapter,index}))
      .filter(({chapter,index})=>!query ||
        chapter.label.toLowerCase().includes(query) ||
        String(index+1)===query);
  },[chapters,search]);
  const start=Math.max(0,Math.min(scrollIndex,Math.max(0,matches.length-WINDOW)));
  const visible=matches.slice(start,start+WINDOW);
  useEffect(()=>{
    if(!open)return;
    setSearch('');setScrollIndex(0);
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const timer=requestAnimationFrame(()=>{
      input.current?.focus();
      if(list.current&&current>=0){
        list.current.scrollTop=Math.max(0,current-3)*ROW;
        setScrollIndex(Math.max(0,current-6));
      }
    });
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeRef.current();}
      if(event.key==='Tab'){
        const focusable=Array.from(document.querySelectorAll<HTMLElement>(
          '.manga-chapter-dialog button:not(:disabled),.manga-chapter-dialog input:not(:disabled)'));
        if(!focusable.length)return;
        const first=focusable[0]!,last=focusable[focusable.length-1]!;
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',key,true);
    return ()=>{cancelAnimationFrame(timer);document.removeEventListener('keydown',key,true);previous?.focus();};
  },[open,current]);
  if(!open)return null;
  return <div className="manga-picker-shade" onMouseDown={event=>{
    if(event.target===event.currentTarget)onClose();
  }}>
    <section className="manga-chapter-dialog" role="dialog" aria-modal="true"
      aria-label="Choose chapter">
      <header className="manga-picker-header">
        <div><p className="manga-overline">CHAPTER NAVIGATION</p>
          <h2>Choose a chapter</h2>
          <p>{chapters.length.toLocaleString()} chapters · Current: {current>=0?current+1:'Not started'}</p>
        </div>
        <button type="button" className="manga-picker-close" aria-label="Close chapter picker"
          onClick={onClose}>×</button>
      </header>
      <label className="manga-picker-search">
        <span className="manga-sr-only">Search chapters by name or number</span>
        <span aria-hidden="true">⌕</span>
        <input ref={input} type="search" autoComplete="off"
          aria-label="Search chapters by name or number" value={search}
          placeholder="Search chapter number or title…"
          onChange={event=>{setSearch(event.target.value);setScrollIndex(0);if(list.current)list.current.scrollTop=0;}}/>
      </label>
      <div className="manga-picker-results" role="list" ref={list}
        onScroll={event=>setScrollIndex(Math.max(0,Math.floor(event.currentTarget.scrollTop/ROW)-6))}>
        <div style={{height:start*ROW}} aria-hidden="true"/>
        {visible.map(({chapter,index})=><button type="button" role="listitem" key={chapter.id}
          className={'manga-picker-result'+(chapter.id===currentChapterId?' is-current':'')}
          aria-current={chapter.id===currentChapterId?'true':undefined}
          disabled={disabled} onClick={()=>{onSelect(chapter.id);onClose();}}>
          <span className="manga-picker-index">{index+1}</span>
          <span className="manga-picker-title">{chapter.label}</span>
          {chapter.id===currentChapterId?<span className="manga-picker-current">Current</span>:
            <span aria-hidden="true">→</span>}
        </button>)}
        <div style={{height:Math.max(0,matches.length-start-visible.length)*ROW}} aria-hidden="true"/>
        {!matches.length&&<p className="manga-picker-empty">No chapters match your search.</p>}
      </div>
      <footer className="manga-picker-footer">Select a chapter to start reading from its first page.</footer>
    </section>
  </div>;
}
