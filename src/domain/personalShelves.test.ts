import { describe, expect, it } from 'vitest';
import { demoEntries } from '../data/fixtures';
import { loadShelves, readShelf, saveShelf, shelfKey } from './personalShelves';

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear() { data.clear(); },
    getItem(k) { return data.get(k) ?? null; },
    key(i) { return [...data.keys()][i] ?? null; },
    removeItem(k) { data.delete(k); },
    setItem(k,v) { data.set(k,v); },
  };
}
describe('private per-series reading shelves', () => {
  const a = demoEntries[0]!.id;
  const b = demoEntries[1]!.id;
  it('isolates selections by stable id and allows removal', () => {
    const s = fakeStorage();
    expect(saveShelf(a,'trying',s)).toBe('ok');
    expect(saveShelf(b,'finished',s)).toBe('ok');
    expect(loadShelves(demoEntries,s).shelves).toMatchObject({[a]:'trying',[b]:'finished'});
    expect(saveShelf(a,null,s)).toBe('ok');
    expect(readShelf(a,s)).toEqual({status:'ok',value:null});
    expect(readShelf(b,s)).toEqual({status:'ok',value:'finished'});
  });
  it('does not overwrite a corrupt record or accept unknown shelf names', () => {
    const s = fakeStorage();
    s.setItem(shelfKey(a),'{broken');
    expect(saveShelf(a,'to-read',s)).toBe('invalid');
    expect(saveShelf(b,'unknown' as 'trying',s)).toBe('invalid');
    expect(loadShelves(demoEntries,s).invalid).toBe(1);
    expect(s.getItem(shelfKey(a))).toBe('{broken');
  });
  it('remains session-only when storage is unavailable or full', () => {
    expect(saveShelf(a,'trying',null)).toBe('unavailable');
    const s=fakeStorage();s.setItem=()=>{throw Error('quota');};
    expect(saveShelf(a,'trying',s)).toBe('unavailable');
  });
});
