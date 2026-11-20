import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MangaCoverArtwork} from './MangaCoverArtwork';
import {demoEntries} from '../data/fixtures';

describe('private manga cover presentation',()=>{
 it('uses the canonical authenticated same-origin endpoint without exposing dataset URLs',()=>{
   const item={...demoEntries[0]!,coverAsset:{
     assetPath:'covers/'+demoEntries[0]!.id+'.webp',mimeType:'image/webp' as const,
     byteSize:128,sha256:'a'.repeat(64)}};
   const html=renderToStaticMarkup(<MangaCoverArtwork entry={item}/>);
   expect(html).toContain('/api/media/cover?mangaId=');
   expect(html).toContain('loading="lazy"');
   expect(html).not.toContain('huggingface.co');
   expect(html).not.toContain('hf_');
 });
 it('renders no broken image for legacy catalogue entries without covers',()=>{
   expect(renderToStaticMarkup(<MangaCoverArtwork entry={demoEntries[0]!}/>)).toBe('');
 });
});
