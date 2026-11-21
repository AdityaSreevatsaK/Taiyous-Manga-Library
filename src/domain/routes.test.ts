import { describe, expect, it } from 'vitest';
import { parseAppRoute, resolveAppRoute, routeHref, publicSeriesSlug, slugify } from './routes';
import {demoEntries} from '../data/fixtures';

describe('stable browser routes', () => {
  it('keeps six visible shelves and sends legacy bookmarks to their replacement views', () => {
    for (const section of ['reading','trying','offline','finished','library'] as const) {
      expect(parseAppRoute('/'+section)).toEqual({kind:section});
      expect(routeHref({kind:section})).toBe('/'+section);
    }
    expect(parseAppRoute('/to-read')).toEqual({kind:'library'});
    expect(parseAppRoute('/analytics')).toEqual({kind:'master',view:'analytics'});
    expect(routeHref({kind:'master',view:'analytics'})).toBe('/master?view=analytics');
    expect(parseAppRoute('/master','?view=analytics')).toEqual({kind:'master',view:'analytics'});
    expect(parseAppRoute('/unknown-section')).toEqual({kind:'not-found'});
  });
  it('exposes a dedicated Master route without adding a ninth shelf',()=>{
    expect(parseAppRoute('/master')).toEqual({kind:'master'});
    expect(routeHref({kind:'master'})).toBe('/master');
    expect(parseAppRoute('/Taiyous-Manga-Library/master','','/Taiyous-Manga-Library/'))
      .toEqual({kind:'master'});
    expect(routeHref({kind:'master'},'/Taiyous-Manga-Library/'))
      .toBe('/Taiyous-Manga-Library/master');
    expect(parseAppRoute('/Taiyous-Manga-Library/analytics','','/Taiyous-Manga-Library/'))
      .toEqual({kind:'master',view:'analytics'});
    expect(routeHref({kind:'master',view:'analytics'},'/Taiyous-Manga-Library/'))
      .toBe('/Taiyous-Manga-Library/master?view=analytics');
    expect(resolveAppRoute({kind:'master'},demoEntries)).toEqual({kind:'master'});
  });
  it('distinguishes home, library, details, and chapter page', () => {
    expect(parseAppRoute('/', '')).toEqual({ kind: 'home' });
    expect(parseAppRoute('/library')).toEqual({ kind: 'library' });
    expect(parseAppRoute('/offline')).toEqual({ kind: 'offline' });
    expect(routeHref({kind:'offline'})).toBe('/offline');
    expect(parseAppRoute('/manga/mng_sample')).toEqual({ kind: 'details', mangaId: 'mng_sample' });
    expect(parseAppRoute('/manga/mng_sample/chapters/ch_first', '?page=5')).toEqual({
      kind: 'reader', mangaId: 'mng_sample', chapterId: 'ch_first', pageIndex: 4,
    });
  });
  it('generates reversible links using a deployment base prefix', () => {
    const route = { kind: 'reader' as const, mangaId: 'mng_sample', chapterId: 'ch_first', pageIndex: 3 };
    const url = routeHref(route, '/Taiyous-Manga-Library/');
    expect(url).toBe('/Taiyous-Manga-Library/manga/mng_sample/chapters/ch_first?page=4');
    const [path, search] = url.split('?');
    expect(parseAppRoute(path!, '?' + search, '/Taiyous-Manga-Library/')).toEqual(route);
  });
  it('rejects invalid IDs, page indexes and unrelated paths', () => {
    for (const path of ['/manga/../chapters/ch_valid', '/manga/%2Fetc', '/random', '/manga/']) {
      expect(parseAppRoute(path).kind).toBe('not-found');
    }
    for (const page of ['0', '-1', '1.5', 'NaN', '99999999999999999999']) {
      expect(parseAppRoute('/manga/mng_id/chapters/ch_id', '?page=' + page).kind).toBe('not-found');
    }
  });
  it('does not confuse sibling host paths with the app base', () => {
    expect(parseAppRoute('/other/library', '', '/Taiyous-Manga-Library/').kind).toBe('not-found');
    expect(parseAppRoute('/Taiyous-Manga-Library/library', '', '/Taiyous-Manga-Library/')).toEqual({ kind: 'library' });
  });
});

describe('readable, canonical slugs backed by immutable manga identities',()=>{
  const sample=demoEntries[0]!;
  const chapter=sample.chapters[0]!;
  const manga={...sample,title:'ReLIFE',slug:'relife',aliases:['ReLife Webcomic'],
    chapters:[{...chapter,label:'Chapter 1',slug:'chapter-1'}]};
  const book=[manga];
  it('generates readable links with optional page number while retaining old IDs',()=>{
    const details={kind:'details' as const,mangaId:manga.id};
    const reader={kind:'reader' as const,mangaId:manga.id,chapterId:chapter.id,pageIndex:0};
    expect(routeHref(details,'/',book)).toBe('/manga/relife');
    expect(routeHref(reader,'/',book)).toBe('/manga/relife/chapters/chapter-1');
    expect(routeHref({...reader,pageIndex:3},'/',book))
      .toBe('/manga/relife/chapters/chapter-1?page=4');
    expect(resolveAppRoute(parseAppRoute('/manga/relife/chapters/chapter-1'),book)).toEqual(reader);
    expect(resolveAppRoute(parseAppRoute('/manga/relife/chapters/chapter-1','?page=4'),book))
      .toEqual({...reader,pageIndex:3});
    expect(resolveAppRoute(parseAppRoute('/manga/'+manga.id+'/chapters/'+chapter.id,'?page=1'),book))
      .toEqual(reader);
    expect(resolveAppRoute(parseAppRoute('/manga/'+manga.id),book)).toEqual(details);
    expect(routeHref(reader,'/Taiyous-Manga-Library/',book))
      .toBe('/Taiyous-Manga-Library/manga/relife/chapters/chapter-1');
  });
  it('keeps permalinks unchanged if title and chapter label are renamed',()=>{
    const renamed={...manga,title:'Life After School',aliases:['ReLIFE'],
      chapters:[{...manga.chapters[0]!,label:'Episode One'}]};
    const old=routeHref({kind:'reader',mangaId:manga.id,chapterId:chapter.id,pageIndex:0},'/',book);
    const newUrl=routeHref({kind:'reader',mangaId:manga.id,chapterId:chapter.id,pageIndex:0},'/',[renamed]);
    expect(old).toBe(newUrl);
    expect(resolveAppRoute(parseAppRoute(old),[renamed])).toMatchObject({mangaId:manga.id,chapterId:chapter.id});
    expect(publicSeriesSlug(renamed,[renamed])).toBe('relife');
  });
  it('recognises old title aliases while rejecting ambiguous slug matches',()=>{
    expect(resolveAppRoute(parseAppRoute('/manga/relife-webcomic'),book))
      .toEqual({kind:'details',mangaId:manga.id});
    const second={...manga,id:'mng_'+'f'.repeat(24),title:'ReLIFE Webcomic',slug:'another-relife'};
    expect(resolveAppRoute(parseAppRoute('/manga/relife-webcomic'),[manga,second]).kind).toBe('not-found');
    expect(resolveAppRoute(parseAppRoute('/manga/not-in-library'),book).kind).toBe('not-found');
  });
  it('disambiguates identical legacy titles with stable ID suffixes',()=>{
    const second={...manga,id:'mng_'+'d'.repeat(24),slug:undefined};
    const first={...manga,slug:undefined};
    expect(publicSeriesSlug(first,[first,second])).toMatch(/^relife--[a-z0-9_-]{8}$/);
    expect(routeHref({kind:'details',mangaId:first.id},'/',[first,second]))
      .not.toBe(routeHref({kind:'details',mangaId:second.id},'/',[first,second]));
  });
  it('handles punctuation, accents and unexpected characters safely',()=>{
    expect(slugify(' ReLIFE! ')).toBe('relife');
    expect(slugify('Café & Créme')).toBe('cafe-creme');
    expect(resolveAppRoute(parseAppRoute('/manga/%2Fetc'),book).kind).toBe('not-found');
  });
});
