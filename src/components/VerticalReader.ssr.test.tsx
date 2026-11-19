import { describe,expect,it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VerticalReader } from './VerticalReader';
import { demoEntries,demoManifests } from '../data/fixtures';

describe('1,000-page long-chapter static layout',()=>{
  it('reserves all original aspect ratios without decoding 1,000 images at once',()=>{
    const chapter=demoEntries[0]!.chapters[0]!;
    const original=demoManifests.get(chapter.id)!;
    const pages=Array.from({length:1000},(_,i)=>{
      const source=original.pages[i%original.pages.length]!;
      return {...source,id:'pg_loadtest'+String(i).padStart(4,'0'),
        order:i,width:i%3===0?720:source.width,height:i%3===0?1440:source.height};
    });
    const html=renderToStaticMarkup(<VerticalReader
      manifest={{...original,pages}}
      activeIndex={500} jumpToken={0}
      onActivePage={()=>{}} onViewedPage={()=>{}} />);
    const slots=[...html.matchAll(/data-vertical-page="/g)];
    expect(slots).toHaveLength(1000);
    expect(html).toContain('aspect-ratio:720 / 1440');
    expect(html).not.toContain('class="vertical-page-image"');
    expect(html).not.toContain('<img');
    expect(html.length).toBeLessThan(1_500_000);
  });
});
