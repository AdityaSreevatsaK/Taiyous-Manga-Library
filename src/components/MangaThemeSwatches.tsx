import type { CSSProperties } from 'react';
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
export function MangaThemeSwatches({value,onChange}:{
  value:Theme;onChange:(theme:Theme)=>void;
}){
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
