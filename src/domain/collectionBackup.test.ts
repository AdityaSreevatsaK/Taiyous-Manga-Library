import { describe,expect,it } from 'vitest';
import { createCollection,emptyCollections,loadCollections,saveCollections,
  setCollectionMembership } from './personalCollections';
import { importCollectionMerge,planCollectionMerge } from './collectionBackup';
function fake():Storage {
  const m=new Map<string,string>();
  return {get length(){return m.size},clear(){m.clear()},
    getItem(k){return m.get(k)??null},key(i){return [...m.keys()][i]??null},
    setItem(k,v){m.set(k,v)},removeItem(k){m.delete(k)}};
}
describe('safe collection backup union',()=>{
  it('imports a nested tree without moving or deleting existing personal collections',()=>{
    let a=createCollection(emptyCollections(),'id_a','Current');
    a=setCollectionMembership(a,'id_a','mng_existing0001',true);
    const b=createCollection(createCollection(emptyCollections(),'id_b','Incoming'), 'id_c','Child','id_b');
    const plan=planCollectionMerge(a,b);
    expect(plan.added).toBe(2);
    expect(plan.state.items.map(x=>x.name)).toEqual(['Current','Incoming','Child']);
    expect(plan.state.items[0]?.mangaIds).toEqual(['mng_existing0001']);
  });
  it('protects conflicting IDs and names while skipping orphaned descendants',()=>{
    const local=createCollection(emptyCollections(),'id_a','Existing');
    const incoming=createCollection(createCollection(emptyCollections(),'id_b','Existing'),'id_c','Under','id_b');
    const plan=planCollectionMerge(local,incoming);
    expect(plan.added).toBe(0);
    expect(plan.skipped).toBe(2);
    expect(plan.state.items).toEqual(local.items);
    const conflictID=createCollection(emptyCollections(),'id_a','Different');
    expect(planCollectionMerge(local,conflictID)).toMatchObject({added:0,skipped:1});
  });
  it('uses revision-guarded browser writes and preserves malformed stores',()=>{
    const store=fake();
    const source=createCollection(emptyCollections(),'id_x','New');
    const local=createCollection(emptyCollections(),'id_a','Original');
    expect(saveCollections(local,0,store).status).toBe('ok');
    const merged=importCollectionMerge(source,store);
    expect(merged).toEqual({status:'ok',added:1,skipped:0});
    expect(loadCollections(store)).toMatchObject({status:'ok',value:{revision:2}});
    expect(importCollectionMerge(source,store)).toMatchObject({status:'ok',added:0,skipped:1});
    store.setItem('taiyou-manga:personal-collections:v1','{broken');
    expect(importCollectionMerge(source,store).status).toBe('invalid');
    expect(store.getItem('taiyou-manga:personal-collections:v1')).toBe('{broken');
    expect(importCollectionMerge(source,null).status).toBe('unavailable');
  });
});
