import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MangaChapterPicker} from './MangaChapterPicker';
import type {MangaChapter} from '../domain/types';

const chapters:MangaChapter[]=Array.from({length:237},(_,index)=>({
  id:'ch_'+String(index).padStart(24,'0'),
  label:index===18?'Chapter 19.5':'Chapter '+(index+1),
  sequence:index,
}));
describe('Novel Library-compatible manga chapter navigation',()=>{
  it('virtualises a 237 chapter list without opening a native select',()=>{
    const html=renderToStaticMarkup(<MangaChapterPicker
      open chapters={chapters} currentChapterId={chapters[0]!.id}
      onClose={()=>{}} onSelect={()=>{}}/>);
    expect((html.match(/class="manga-picker-result/g)||[])).toHaveLength(48);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Search chapters by name or number');
    expect(html).toContain('237 chapters');
    expect(html).toContain('Current');
    expect(html).not.toContain('<select');
  });
  it('renders nothing while closed, leaving the manga reader unblocked',()=>{
    const html=renderToStaticMarkup(<MangaChapterPicker
      open={false} chapters={chapters} currentChapterId={chapters[0]!.id}
      onClose={()=>{}} onSelect={()=>{}}/>);
    expect(html).toBe('');
  });
});
