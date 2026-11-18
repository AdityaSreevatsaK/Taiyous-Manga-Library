import { describe, expect, it } from 'vitest';
import { searchCatalogue } from './search';
describe('local catalogue search', () => {
  const records = [
    { title:'Example A', aliases:['Alternate A'] },
    { title:'Another B', aliases:['Different Name'] },
  ];
  it('searches title and alias without mutating records', () => {
    expect(searchCatalogue(records,'alternate')).toEqual([records[0]]);
    expect(searchCatalogue(records,'EXAMPLE')).toEqual([records[0]]);
    expect(searchCatalogue(records,'unknown')).toEqual([]);
    expect(searchCatalogue(records,'')).toEqual(records);
  });
});
