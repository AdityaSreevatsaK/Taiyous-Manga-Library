import { describe, expect, it } from 'vitest';
import { demoEntries, demoManifests } from '../data/fixtures';
import { annotationKey, readAnnotation, saveAnnotation, canonicalCompletedChapterIds } from './personalAnnotations';
import { exportFullBackup, previewFullBackup, restoreFullBackup } from './localFullBackup';
import { saveProgress } from './localReaderStorage';

function storage():Storage {
  const data=new Map<string,string>();
  return {
    get length(){return data.size;},clear(){data.clear();},
    getItem(k){return data.get(k)??null;},key(i){return [...data.keys()][i]??null;},
    setItem(k,v){data.set(k,v);},removeItem(k){data.delete(k);},
  };
}
const series=demoEntries[0]!;
const firstChapter=series.chapters[0]!.id;
const secondChapter=series.chapters[1]!.id;

describe('explicit device-local chapter completion',()=>{
  it('requires an explicit choice and stays independent of page progress',()=>{
    const store=storage();
    const page=demoManifests.get(firstChapter)!.pages[0]!;
    expect(saveProgress({
      mangaId:series.id,chapterId:firstChapter,pageId:page.id,pageIndex:0,
      updatedAt:'2026-11-19T18:00:00.000Z',
    },series,demoManifests,store).status).toBe('ok');
    expect(readAnnotation(series.id,store)).toEqual({status:'ok',value:null});
    expect(saveAnnotation(series.id,{completedChapterIds:[secondChapter,firstChapter],rating:10},store).status).toBe('ok');
    expect(readAnnotation(series.id,store)).toMatchObject({status:'ok',value:{
      completedChapterIds:[firstChapter,secondChapter].sort(),rating:10,
    }});
    expect(saveAnnotation(series.id,{completedChapterIds:[secondChapter]},store).status).toBe('ok');
    expect(readAnnotation(series.id,store)).toMatchObject({status:'ok',value:{
      completedChapterIds:[secondChapter],rating:10,
    }});
    expect(saveAnnotation(series.id,{completedChapterIds:[]},store).status).toBe('ok');
    const cleared=readAnnotation(series.id,store);
    if(cleared.status==='ok')expect(cleared.value?.completedChapterIds).toBeUndefined();
  });
  it('rejects malformed or repeated chapter IDs and leaves corrupt storage untouched',()=>{
    expect(()=>canonicalCompletedChapterIds([firstChapter,firstChapter])).toThrow('duplicate');
    expect(()=>canonicalCompletedChapterIds(['https://private.example/secret'])).toThrow('Invalid');
    expect(()=>canonicalCompletedChapterIds('not-an-array')).toThrow('Invalid');
    expect(()=>canonicalCompletedChapterIds(Array.from({length:2001},()=>firstChapter))).toThrow('Invalid');
    const store=storage();
    const key=annotationKey(series.id);
    store.setItem(key,JSON.stringify({schemaVersion:1,mediaKind:'manga',annotation:{
      mangaId:series.id,rating:null,notes:'retain',tags:[],
      updatedAt:'2026-11-19T00:00:00.000Z',completedChapterIds:[firstChapter,firstChapter],
    }}));
    const saved=store.getItem(key);
    expect(readAnnotation(series.id,store).status).toBe('invalid');
    expect(saveAnnotation(series.id,{rating:9},store).status).toBe('invalid');
    expect(store.getItem(key)).toBe(saved);
  });
  it('restores manual completion through v2 backup, but rejects foreign chapter ownership',()=>{
    const source=storage(),target=storage();
    expect(saveAnnotation(series.id,{completedChapterIds:[firstChapter],notes:'Keep this'},source).status).toBe('ok');
    const backup=exportFullBackup(demoEntries,demoManifests,source).document;
    expect(backup.schemaVersion).toBe(2);
    const plan=previewFullBackup(backup,demoEntries,demoManifests,target);
    expect(plan.annotationRestorable).toBe(1);
    expect(restoreFullBackup(plan,demoEntries,demoManifests,target,false,true).annotationsRestored).toBe(1);
    expect(readAnnotation(series.id,target)).toMatchObject({
      status:'ok',value:{completedChapterIds:[firstChapter],notes:'Keep this'},
    });
    const foreign=demoEntries[1]!.chapters[0]!.id;
    const invalid={...backup,annotations:backup.annotations.map(value=>({
      ...value,completedChapterIds:[foreign],
    }))};
    const empty=storage();
    expect(()=>previewFullBackup(invalid,demoEntries,demoManifests,empty))
      .toThrow('outside their manga');
    expect(empty.length).toBe(0);
  });
});
