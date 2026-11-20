import type { CSSProperties } from 'react';
import type { ReaderPreferences } from '../domain/localReaderStorage';

type Theme = ReaderPreferences['theme'];
const options: readonly {id:Theme; label:string; swatch:string; ink:string}[] = [
  {id:'sepia',label:'Sepia',swatch:'#e9dbc2',ink:'#493323'},
  {id:'paper',label:'Paper',swatch:'#faf9f6',ink:'#304656'},
  {id:'charcoal',label:'Charcoal',swatch:'#353b43',ink:'#f2eddf'},
  {id:'midnight',label:'Midnight',swatch:'#162945',ink:'#f2eddf'},
  {id:'ocean',label:'Ocean',swatch:'#e1f0f9',ink:'#254a71'},
  {id:'plum',label:'Plum',swatch:'#44324f',ink:'#f2eddf'},
];

/** A one-click theme picker matching the Novel Library masthead.
 * Opening or focusing a swatch never changes the selected theme.
 */
export function MangaThemeSwatches({value,onChange}:{
  value:Theme;onChange:(theme:Theme)=>void;
}) {
  return <div className="manga-theme-swatches" role="group" aria-label="App theme">
    {options.map(option=><button type="button" key={option.id}
      className={'manga-theme-swatch'+(value===option.id?' is-selected':'')}
      aria-label={'Use '+option.label+' theme'} title={option.label}
      aria-pressed={value===option.id} onClick={()=>onChange(option.id)}
      style={{'--swatch-bg':option.swatch,'--swatch-ink':option.ink} as CSSProperties}>
      <span className="manga-theme-dot" aria-hidden="true">{value===option.id?'✓':''}</span>
    </button>)}
  </div>;
}
