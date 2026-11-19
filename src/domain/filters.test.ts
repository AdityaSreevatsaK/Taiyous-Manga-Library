import { describe, expect, it } from 'vitest';
import { demoEntries } from '../data/fixtures';
import { filterCatalogue } from './filters';
describe('fixture catalogue filters', () => {
  it('finds aliases, tags, status and collection without changing the data', () => {
    expect(filterCatalogue(demoEntries,'last light','all','','','title')[0]?.title).toBe('The Lantern Archive');
    expect(filterCatalogue(demoEntries,'','completed','','','title')).toHaveLength(2);
    expect(filterCatalogue(demoEntries,'','all','Fantasy','','title')).toHaveLength(3);
    expect(filterCatalogue(demoEntries,'','all','','Nightfall Stories','title')).toHaveLength(2);
    expect(filterCatalogue(demoEntries,'missing','all','','','title')).toEqual([]);
    expect(demoEntries[0]?.title).toBe('Five Chapter Scroll Trial');
  });
  it('sorts by chapter count, rating and title', () => {
    expect(filterCatalogue(demoEntries,'','all','','','chapters')[0]?.chapters.length).toBe(5);
    expect(filterCatalogue(demoEntries,'','all','','','rating')[0]?.rating).toBe(9);
  });
});
