import { describe, expect, it } from 'vitest';
import { demoEntries, demoManifests } from '../data/fixtures';
import { loadProgress, saveProgress } from './localReaderStorage';
import { readAnnotation, saveAnnotation, annotationKey } from './personalAnnotations';
import { readShelf, saveShelf, shelfKey } from './personalShelves';
import { exportFullBackup, previewFullBackup, restoreFullBackup } from './localFullBackup';
import { exportLocalReaderBackup } from './localReaderBackup';
import type { MangaProgress } from './types';
function memory():Storage {
  const map=new Map<string,string>();
  return {
    get length(){return map.size;},clear(){map.clear();},getItem(k){return map.get(k)??null;},
    key(i){return [...map.keys()][i]??null;},setItem(k,v){map.set(k,v);},removeItem(k){map.delete(k);},
  };
}
const first=demoEntries[0]!,second=demoEntries[1]!;
function sampleProgress():MangaProgress {
  const chapterId=first.chapters[0]!.id;
  return {mangaId:first.id,chapterId,pageIndex:0,pageId:demoManifests.get(chapterId)!.pages[0]!.id,
    readingMode:'vertical',updatedAt:'2026-11-19T00:00:00.000Z'};
}
describe('versioned personal backups',()=>{
  it('exports a private v2 envelope containing validated data but no images',()=>{
    const source=memory();
    expect(saveShelf(first.id,'trying',source)).toBe('ok');
    expect(saveAnnotation(first.id,{rating:10,notes:'private thought',tags:['Romance']},source).status).toBe('ok');
    expect(saveProgress(sampleProgress(),first,demoManifests,source).status).toBe('ok');
    const result=exportFullBackup(demoEntries,demoManifests,source,new Date('2026-11-19T01:00:00.000Z'));
    expect(result.document.schemaVersion).toBe(2);
    expect(result.document.reader.progress).toHaveLength(1);
    expect(result.document.shelves).toEqual([{mangaId:first.id,shelf:'trying'}]);
    expect(result.document.annotations[0]).toMatchObject({notes:'private thought',rating:10,tags:['Romance']});
    expect(JSON.stringify(result.document)).not.toContain('assetPath');
    expect(JSON.stringify(result.document)).not.toContain('data:image');
  });
  it('accepts old v1 progress-only exports without changing existing private notes',()=>{
    const existing=memory(),old=memory();
    saveAnnotation(first.id,{notes:'keep'},existing);
    saveProgress(sampleProgress(),first,demoManifests,old);
    const legacy=exportLocalReaderBackup(demoEntries,demoManifests,old).document;
    const plan=previewFullBackup(legacy,demoEntries,demoManifests,existing);
    expect(plan.shelves).toHaveLength(0);
    expect(plan.annotations).toHaveLength(0);
    const imported=restoreFullBackup(plan,demoEntries,demoManifests,existing,false,true);
    expect(imported.reader.restored).toBe(1);
    expect(imported.annotationsRestored).toBe(0);
    expect(readAnnotation(first.id,existing)).toMatchObject({status:'ok',value:{notes:'keep'}});
  });
  it('imports personal records only on explicit opt-in and does not overwrite an occupied shelf',()=>{
    const original=memory(),target=memory();
    saveShelf(first.id,'finished',original);
    saveAnnotation(first.id,{rating:9,notes:'my notes',tags:['My Tag']},original);
    saveProgress(sampleProgress(),first,demoManifests,original);
    const backup=exportFullBackup(demoEntries,demoManifests,original).document;
    saveShelf(first.id,'trying',target);
    const plan=previewFullBackup(backup,demoEntries,demoManifests,target);
    expect(plan.conflicts).toBe(1);
    expect(plan.annotationRestorable).toBe(1);
    const noPersonal=restoreFullBackup(plan,demoEntries,demoManifests,target);
    expect(noPersonal.reader.restored).toBe(1);
    expect(readAnnotation(first.id,target)).toMatchObject({status:'ok',value:null});
    const merged=restoreFullBackup(plan,demoEntries,demoManifests,target,false,true);
    expect(merged.annotationsRestored).toBe(1);
    expect(merged.metadataSkipped).toBe(1);
    expect(readShelf(first.id,target)).toEqual({status:'ok',value:'trying'});
    expect(readAnnotation(first.id,target)).toMatchObject({status:'ok',value:{rating:9,notes:'my notes'}});
    expect(loadProgress(first,demoManifests,target).status).toBe('ok');
  });
  it('protects newer annotations, corrupt local data and unknown series',()=>{
    const source=memory(),target=memory();
    saveAnnotation(first.id,{notes:'earlier note'},source);
    saveShelf(second.id,'to-read',source);
    const backup=exportFullBackup(demoEntries,demoManifests,source).document;
    saveAnnotation(first.id,{notes:'newer note'},target);
    target.setItem(shelfKey(second.id),'{damaged');
    const plan=previewFullBackup(backup,demoEntries,demoManifests,target);
    expect(plan.conflicts).toBe(2);
    const result=restoreFullBackup(plan,demoEntries,demoManifests,target,false,true);
    expect(result.metadataSkipped).toBe(2);
    expect(readAnnotation(first.id,target)).toMatchObject({status:'ok',value:{notes:'newer note'}});
    expect(target.getItem(shelfKey(second.id))).toBe('{damaged');
    const unknown='mng_unknown0001';
    const altered={...backup,annotations:[...backup.annotations,
      {...backup.annotations[0]!,mangaId:unknown}]};
    expect(previewFullBackup(altered,demoEntries,demoManifests,target).unknownPersonal).toBe(1);
  });
  it('rejects invalid v2 files entirely before any writes',()=>{
    const store=memory(),source=memory();
    saveAnnotation(first.id,{rating:4},source);
    const doc=exportFullBackup(demoEntries,demoManifests,source).document;
    const preview=(value:unknown)=>previewFullBackup(value,demoEntries,demoManifests,store);
    expect(()=>preview({...doc,schemaVersion:3})).toThrow('not a supported');
    expect(()=>preview({...doc,annotations:[{...doc.annotations[0],rating:11}]})).toThrow('invalid notes');
    expect(()=>preview({...doc,annotations:[doc.annotations[0],doc.annotations[0]]})).toThrow('duplicate');
    expect(()=>preview({...doc,shelves:[{mangaId:first.id,shelf:'unknown'}]})).toThrow('invalid or duplicate');
    expect(store.length).toBe(0);
  });
  it('handles blocked browser storage safely and never deletes existing records',()=>{
    const source=memory(),target=memory();
    saveAnnotation(first.id,{rating:2},source);
    const doc=exportFullBackup(demoEntries,demoManifests,source).document;
    expect(()=>exportFullBackup(demoEntries,demoManifests,null)).toThrow('unavailable');
    target.setItem(annotationKey(first.id),'{broken');
    const plan=previewFullBackup(doc,demoEntries,demoManifests,target);
    expect(restoreFullBackup(plan,demoEntries,demoManifests,target,false,true).metadataSkipped).toBe(1);
    expect(target.getItem(annotationKey(first.id))).toBe('{broken');
  });
});
