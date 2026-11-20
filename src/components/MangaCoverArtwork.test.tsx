import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MangaCoverArtwork} from './MangaCoverArtwork';
import {mangaCoverKey} from '../data/coverCache';
import {demoEntries} from '../data/fixtures';

describe('private manga cover presentation',()=>{
 it('does not trigger an uncached image request until IndexedDB has been checked',()=>{
   const item={...demoEntries[0]!,cover:{
     assetPath:'covers/'+demoEntries[0]!.id+'.webp',mimeType:'image/webp' as const,
     width:800,height:1200,byteSize:128,sha256:'a'.repeat(64)}};
   const html=renderToStaticMarkup(<MangaCoverArtwork entry={item}/>);
   expect(html).toContain('manga-cover-loader');
   expect(html).not.toContain('/api/media/cover?');
   expect(html).not.toContain('huggingface.co');
   expect(html).not.toContain('hf_');
   expect(mangaCoverKey(item)).toContain(item.cover.sha256);
 });
 it('renders no broken image for legacy catalogue entries without covers',()=>{
   expect(renderToStaticMarkup(<MangaCoverArtwork entry={demoEntries[0]!}/>)).toBe('');
 });
});
