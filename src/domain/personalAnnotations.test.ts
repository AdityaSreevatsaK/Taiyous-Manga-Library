import { describe, expect, it } from 'vitest';
import { demoEntries } from '../data/fixtures';
import { addPersonalTag, annotationKey, canonicalTags, loadAnnotations,
  normalisePersonalTag, readAnnotation, saveAnnotation } from './personalAnnotations';

function memoryStorage(): Storage {
  const map = new Map<string,string>();
  return {
    get length(){return map.size;},clear(){map.clear();},
    key(i){return [...map.keys()][i] ?? null;},getItem(k){return map.get(k) ?? null;},
    setItem(k,v){map.set(k,v);},removeItem(k){map.delete(k);},
  };
}
const a=demoEntries[0]!.id, b=demoEntries[1]!.id;
describe('personal annotations on the device',()=>{
  it('saves ratings, notes and independent tags by immutable series ID',()=>{
    const store=memoryStorage();
    expect(saveAnnotation(a,{rating:10,notes:'My favourite',tags:['Slice of Life','Love']},store).status).toBe('ok');
    expect(saveAnnotation(a,{rating:1},store)).toMatchObject({status:'ok',value:{rating:1,notes:'My favourite'}});
    expect(saveAnnotation(b,{notes:'Another series'},store).status).toBe('ok');
    const all=loadAnnotations(demoEntries,store);
    expect(all.annotations[a]?.tags).toEqual(['Love','Slice Of Life']);
    expect(all.annotations[b]?.rating).toBeNull();
    expect(all.annotations[a]?.rating).toBe(1);
  });
  it('normalises to title case, collapses spaces and deduplicates case-insensitively',()=>{
    expect(normalisePersonalTag('  slice   of LIFE  ')).toBe('Slice Of Life');
    expect(addPersonalTag(['Slice Of Life'],'SLICE of LIFE')).toEqual(['Slice Of Life']);
    expect(addPersonalTag(['Fantasy'],'romance')).toEqual(['Fantasy','Romance']);
    expect(()=>canonicalTags(['Mecha','MECHA'])).toThrow('Duplicate');
    expect(()=>normalisePersonalTag('<script>')).toThrow();
    expect(()=>canonicalTags(Array(25).fill('tag'))).toThrow();
  });
  it('rejects invalid rating, HTML control characters, oversized notes and tags',()=>{
    const store=memoryStorage();
    for(const rating of [0,11,-1,2.5,NaN]) {
      expect(saveAnnotation(a,{rating},store).status).toBe('invalid');
    }
    expect(saveAnnotation(a,{notes:'x'.repeat(5001)},store).status).toBe('invalid');
    expect(saveAnnotation(a,{notes:'bad\u0000value'},store).status).toBe('invalid');
    expect(saveAnnotation(a,{tags:['<img>']},store).status).toBe('invalid');
    expect(store.length).toBe(0);
  });
  it('preserves malformed existing bytes and isolates other series',()=>{
    const store=memoryStorage();
    store.setItem(annotationKey(a),'{broken');
    expect(saveAnnotation(a,{rating:5},store).status).toBe('invalid');
    expect(saveAnnotation(b,{rating:7},store).status).toBe('ok');
    expect(loadAnnotations(demoEntries,store).invalid).toBe(1);
    expect(store.getItem(annotationKey(a))).toBe('{broken');
  });
  it('returns unavailable on blocked writes, without data loss',()=>{
    expect(readAnnotation(a,null).status).toBe('unavailable');
    const store=memoryStorage();
    store.setItem=()=>{throw Error('Quota exceeded');};
    expect(saveAnnotation(a,{rating:2},store).status).toBe('unavailable');
  });
});
