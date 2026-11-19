import { describe, expect, it } from 'vitest';
import { demoEntries, demoManifests } from '../data/fixtures';
import { annotationKey, readAnnotation, saveAnnotation } from './personalAnnotations';
import { exportFullBackup, previewFullBackup, restoreFullBackup } from './localFullBackup';

function storage(): Storage {
  const data = new Map<string,string>();
  return {
    get length(){return data.size;},
    clear(){data.clear();},
    getItem(key){return data.get(key) ?? null;},
    key(index){return [...data.keys()][index] ?? null;},
    removeItem(key){data.delete(key);},
    setItem(key,value){data.set(key,value);},
  };
}
const manga = demoEntries[0]!;

describe('favourite manga: private, backwards-compatible local metadata', () => {
  it('adds and removes a favourite without losing notes, rating or tags', () => {
    const store=storage();
    expect(saveAnnotation(manga.id,{notes:'My notes',rating:9,tags:['Romance']},store).status).toBe('ok');
    expect(saveAnnotation(manga.id,{favourite:true},store).status).toBe('ok');
    expect(readAnnotation(manga.id,store)).toMatchObject({
      status:'ok',value:{favourite:true,notes:'My notes',rating:9,tags:['Romance']},
    });
    expect(saveAnnotation(manga.id,{favourite:false},store).status).toBe('ok');
    const after=readAnnotation(manga.id,store);
    expect(after).toMatchObject({status:'ok',value:{notes:'My notes',rating:9,tags:['Romance']}});
    if(after.status==='ok') expect(after.value?.favourite).toBeUndefined();
  });
  it('round-trips favourite state through the existing v2 personal backup', () => {
    const source=storage(),target=storage();
    expect(saveAnnotation(manga.id,{favourite:true},source).status).toBe('ok');
    const exported=exportFullBackup(demoEntries,demoManifests,source).document;
    expect(exported.schemaVersion).toBe(2);
    expect(exported.annotations[0]?.favourite).toBe(true);
    const preview=previewFullBackup(exported,demoEntries,demoManifests,target);
    expect(preview.annotationRestorable).toBe(1);
    expect(readAnnotation(manga.id,target)).toEqual({status:'ok',value:null});
    expect(restoreFullBackup(preview,demoEntries,demoManifests,target,false,true).annotationsRestored).toBe(1);
    expect(readAnnotation(manga.id,target)).toMatchObject({status:'ok',value:{favourite:true}});
  });
  it('keeps old records without favourite and refuses malformed values without overwriting bytes', () => {
    const store=storage();
    expect(saveAnnotation(manga.id,{rating:8},store).status).toBe('ok');
    const old=readAnnotation(manga.id,store);
    if(old.status==='ok') expect(old.value?.favourite).toBeUndefined();
    const key=annotationKey(manga.id);
    const raw=store.getItem(key)!;
    store.setItem(key,raw.replace('"rating":8','"rating":8,"favourite":"yes"'));
    const corrupted=store.getItem(key);
    expect(readAnnotation(manga.id,store).status).toBe('invalid');
    expect(saveAnnotation(manga.id,{favourite:true},store).status).toBe('invalid');
    expect(store.getItem(key)).toBe(corrupted);
  });
});
