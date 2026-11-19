import { describe, expect, it } from 'vitest';
import { parseAppRoute, routeHref } from './routes';

describe('stable browser routes', () => {
  it('routes all eight library sections without breaking old library bookmarks', () => {
    for (const section of ['reading','trying','offline','finished','to-read','library','analytics'] as const) {
      expect(parseAppRoute('/'+section)).toEqual({kind:section});
      expect(routeHref({kind:section})).toBe('/'+section);
    }
    expect(parseAppRoute('/unknown-section')).toEqual({kind:'not-found'});
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
