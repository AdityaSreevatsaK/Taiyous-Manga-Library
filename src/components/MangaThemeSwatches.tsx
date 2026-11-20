import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type { ReaderPreferences } from '../domain/localReaderStorage';

type Theme=ReaderPreferences['theme'];
/** The exact Novel Library theme swatches and contrast values.
 * Maps Novel "light" to Manga "paper" and "dark" to "charcoal".
 * Source: Taiyous-Personal-Library/src/lib/themes.ts.
 */
const options:readonly {id:Theme;label:string;swatch:string;ink:string}[]=[
  {id:'sepia',label:'Sepia',swatch:'#e9d5b7',ink:'#46382a'},
  {id:'paper',label:'Paper',swatch:'#f9f9f7',ink:'#27303b'},
  {id:'charcoal',label:'Charcoal',swatch:'#30343c',ink:'#f2f4f8'},
  {id:'midnight',label:'Midnight',swatch:'#12213b',ink:'#e7edf9'},
  {id:'ocean',label:'Ocean',swatch:'#dcecf6',ink:'#244464'},
  {id:'plum',label:'Plum',swatch:'#332638',ink:'#f5e7f2'},
];
export function MangaThemeSwatches({value,onChange,compact=false}:{
  value:Theme;onChange:(theme:Theme)=>void;compact?:boolean;
}){
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const closeOutside=(event:PointerEvent)=>{
      if(!root.current?.contains(event.target as Node))setOpen(false);
    };
    const closeEscape=(event:KeyboardEvent)=>{
      if(event.key==='Escape')setOpen(false);
    };
    document.addEventListener('pointerdown',closeOutside);
    document.addEventListener('keydown',closeEscape);
    return()=>{
      document.removeEventListener('pointerdown',closeOutside);
      document.removeEventListener('keydown',closeEscape);
    };
  },[open]);
  if(compact){
    const selected=options.find(option=>option.id===value)??options[0]!;
    return <div className="manga-theme-menu" ref={root}>
      <button type="button" className="manga-theme-menu-toggle"
        aria-label={'Choose colour theme, currently '+selected.label}
        aria-haspopup="true" aria-expanded={open}
        aria-controls="manga-theme-menu-options"
        onClick={()=>setOpen(wasOpen=>!wasOpen)}>
        <span className="manga-theme-compact-dot" style={{background:selected.swatch}} aria-hidden="true"/>
        <span>{selected.label}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open&&<div id="manga-theme-menu-options" className="manga-theme-menu-panel"
        role="group" aria-label="Choose reading colour theme">
        <span className="manga-theme-menu-caption">CHOOSE A THEME</span>
        <div className="manga-theme-menu-grid">
          {options.map(option=><button type="button" key={option.id}
            className="manga-theme-menu-choice" aria-pressed={option.id===value}
            aria-label={'Use '+option.label+' theme'}
            onClick={()=>{onChange(option.id);setOpen(false);}}>
            <span className="manga-theme-menu-preview"
              style={{background:option.swatch,color:option.ink}} aria-hidden="true">
              {option.id===value?'✓':''}</span>
            <span>{option.label}</span>
          </button>)}
        </div>
      </div>}
    </div>;
  }
  return <div className="manga-theme-swatches" role="group" aria-label="App theme">
    {options.map(option=><button type="button" key={option.id}
      className={'manga-theme-swatch'+(value===option.id?' is-selected':'')}
      aria-label={'Use '+option.label+' theme'} title={option.label}
      aria-pressed={value===option.id} onClick={()=>onChange(option.id)}
      style={{'--swatch-bg':option.swatch,'--swatch-ink':option.ink} as CSSProperties}>
      <span className="manga-theme-dot" aria-hidden="true">
        {value===option.id&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="m20 6-11 11-5-5"/>
        </svg>}
      </span>
    </button>)}
  </div>;
}
