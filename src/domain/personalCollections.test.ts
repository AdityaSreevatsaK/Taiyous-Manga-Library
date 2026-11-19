import { describe,expect,it } from 'vitest';
import { cleanCollectionName, collectionBreadcrumb, countCollectionDescendants, createCollection,
  deleteCollectionTree, emptyCollections, loadCollections, moveCollection, renameCollection,
  saveCollections, setCollectionMembership, validateCollections } from './personalCollections';
function memory():Storage {
  const data=new Map<string,string>();
  return {get length(){return data.size;},clear(){data.clear();},
    getItem(k){return data.get(k)??null;},key(i){return [...data.keys()][i]??null;},
    setItem(k,v){data.set(k,v);},removeItem(k){data.delete(k);}};
}
describe('versioned nested personal collections',()=>{
  function tree(){
    const root=createCollection(emptyCollections(),'r','Favorites');
    const child=createCollection(root,'c','Romance','r');
    return createCollection(child,'g','Best', 'c');
  }
  it('supports unlimited logical depth with safe stable IDs and breadcrumb paths',()=>{
    const doc=tree();
    expect(collectionBreadcrumb(doc,'g')).toBe('Favorites / Romance / Best');
    expect(countCollectionDescendants(doc,'r')).toBe(2);
    expect(cleanCollectionName('  My   Great  shelf ')).toBe('My Great shelf');
  });
  it('prevents self, ancestor and indirect nesting cycles',()=>{
    const doc=tree();
    expect(()=>moveCollection(doc,'r','r')).toThrow('cycle');
    expect(()=>moveCollection(doc,'r','g')).toThrow('cycle');
    expect(()=>moveCollection(doc,'c','g')).toThrow('cycle');
    const valid=moveCollection(doc,'g',null);
    expect(collectionBreadcrumb(valid,'g')).toBe('Best');
  });
  it('rejects duplicate siblings by case while allowing other branches',()=>{
    const doc=tree();
    expect(()=>createCollection(doc,'x','favorites')).toThrow('Duplicate');
    expect(()=>createCollection(doc,'x','ROMANCE','r')).toThrow('Duplicate');
    const next=createCollection(doc,'x','Romance');
    expect(next.items).toHaveLength(4);
    expect(()=>renameCollection(doc,'c','Favorites')).not.toThrow();
    expect(()=>renameCollection(doc,'g','Romance')).not.toThrow();
  });
  it('manages memberships independently and never deletes manga when removing a tree',()=>{
    let doc=tree();
    doc=setCollectionMembership(doc,'c','mng_sample123',true);
    doc=setCollectionMembership(doc,'c','mng_sample123',true);
    expect(doc.items.find(item=>item.id==='c')?.mangaIds).toEqual(['mng_sample123']);
    doc=setCollectionMembership(doc,'g','mng_another123',true);
    doc=deleteCollectionTree(doc,'c');
    expect(doc.items.map(x=>x.id)).toEqual(['r']);
    expect(doc.items[0]?.mangaIds).toEqual([]);
  });
  it('guards writes by revision and preserves malformed existing bytes',()=>{
    const store=memory();
    let doc=emptyCollections();
    doc=createCollection(doc,'r','Root');
    const saved=saveCollections(doc,0,store);
    expect(saved.status).toBe('ok');
    expect(saveCollections(doc,0,store).status).toBe('stale');
    expect(loadCollections(store)).toMatchObject({status:'ok',value:{revision:1}});
    store.setItem('taiyou-manga:personal-collections:v1','{broken');
    expect(loadCollections(store).status).toBe('invalid');
    expect(saveCollections(doc,0,store).status).toBe('invalid');
    expect(store.getItem('taiyou-manga:personal-collections:v1')).toBe('{broken');
  });
  it('rejects forged parent and duplicate manga and storage denial',()=>{
    const doc=tree();
    expect(()=>createCollection(doc,'x','Unknown','missing')).toThrow();
    expect(()=>setCollectionMembership(doc,'c','???',true)).toThrow();
    expect(()=>validateCollections({...doc,items:doc.items.map(x=>x.id==='c'?{
      ...x,mangaIds:['mng_a','mng_a'],
    }:x)})).toThrow('duplicate manga');
    expect(saveCollections(doc,doc.revision,null).status).toBe('unavailable');
  });
});
