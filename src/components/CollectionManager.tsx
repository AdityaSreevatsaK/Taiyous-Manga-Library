import { useState, type FormEvent } from 'react';
import { collectionBreadcrumb, countCollectionDescendants, createCollection,
  deleteCollectionTree, moveCollection, renameCollection,
  type CollectionState } from '../domain/personalCollections';

interface Props {
  state: CollectionState;
  onCommit: (next:CollectionState, message:string)=>boolean;
  onFilter: (collectionId:string)=>void;
}
/** Browser-only collection manager. No source metadata or manga files are modified. */
export function CollectionManager({state,onCommit,onFilter}:Props) {
  const [name,setName]=useState('');
  const [parent,setParent]=useState('');
  const [editingId,setEditingId]=useState<string|null>(null);
  const [editName,setEditName]=useState('');
  const [editParent,setEditParent]=useState('');
  const [deleteId,setDeleteId]=useState<string|null>(null);
  const [error,setError]=useState('');
  const sorted=[...state.items].sort((a,b)=>
    collectionBreadcrumb(state,a.id).localeCompare(collectionBreadcrumb(state,b.id)));
  const chosen=state.items.find(item=>item.id===editingId);
  const pending=state.items.find(item=>item.id===deleteId);
  const commit=(make:()=>CollectionState,message:string,done?:()=>void)=>{
    try {
      setError('');
      if(onCommit(make(),message)) done?.();
    } catch(e){setError(e instanceof Error?e.message:'Could not update collection.');}
  };
  const create=(event:FormEvent)=>{
    event.preventDefault();
    const id='pc_'+crypto.randomUUID().replaceAll('-','');
    commit(()=>createCollection(state,id,name,parent||null),'Collection created',()=>{
      setName('');setParent('');
    });
  };
  return <details className="collections-manager">
    <summary>Manage my collections ({state.items.length})</summary>
    <p>Organise manga into your own collections and subcollections. These stay on this device.</p>
    <form className="collection-create" onSubmit={create}>
      <label>New collection name
        <input value={name} maxLength={80} onChange={event=>setName(event.target.value)}
          placeholder="e.g. Favourites" required />
      </label>
      <label>Inside collection
        <select value={parent} onChange={event=>setParent(event.target.value)}>
          <option value="">Top level</option>
          {sorted.map(item=><option key={item.id} value={item.id}>{collectionBreadcrumb(state,item.id)}</option>)}
        </select>
      </label>
      <button type="submit" className="primary" disabled={!name.trim()}>Create collection</button>
    </form>
    {sorted.length===0 ? <p>No personal collections yet. Create one above to get started.</p> :
      <div className="collection-list">
        {sorted.map(item=><div className="collection-list-item" key={item.id}>
          <button className="collection-breadcrumb" type="button" onClick={()=>onFilter(item.id)}
            title="Show manga in this collection">{collectionBreadcrumb(state,item.id)}</button>
          <span>{item.mangaIds.length} manga</span>
          <button className="secondary" type="button"
            onClick={()=>{setEditingId(item.id);setEditName(item.name);setEditParent(item.parentId??'');setError('');}}>Edit</button>
          <button className="secondary collection-delete" type="button" onClick={()=>setDeleteId(item.id)}>Delete</button>
        </div>)}
      </div>}
    {chosen && <div className="collection-editor" aria-label="Edit collection">
      <h3>Edit {chosen.name}</h3>
      <label>Collection name
        <input value={editName} maxLength={80} onChange={event=>setEditName(event.target.value)} />
      </label>
      <label>Move to parent collection
        <select value={editParent} onChange={event=>setEditParent(event.target.value)}>
          <option value="">Top level</option>
          {sorted.filter(item=>item.id!==chosen.id).map(item=>
            <option key={item.id} value={item.id}>{collectionBreadcrumb(state,item.id)}</option>)}
        </select>
      </label>
      <div className="collection-editor-actions">
        <button className="primary" type="button" onClick={()=>commit(()=>
          renameCollection(state,chosen.id,editName),'Collection renamed',()=>setEditingId(null))}>Save name</button>
        <button className="secondary" type="button" onClick={()=>commit(()=>
          moveCollection(state,chosen.id,editParent||null),'Collection moved',()=>setEditingId(null))}>Move collection</button>
        <button className="secondary" type="button" onClick={()=>setEditingId(null)}>Cancel</button>
      </div>
    </div>}
    {error && <p className="collection-error" role="alert">{error}</p>}
    {pending && <div className="dialog-scrim">
      <div className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-collection-title"
        onKeyDown={event=>{if(event.key==='Escape')setDeleteId(null);}}>
        <h2 id="delete-collection-title">Delete this collection?</h2>
        <p>“{pending.name}” and {countCollectionDescendants(state,pending.id)} nested collection(s)
          will be removed from your personal organisation. Manga files and reading progress will not be deleted.</p>
        <div className="dialog-actions">
          <button className="secondary" autoFocus type="button" onClick={()=>setDeleteId(null)}>Cancel</button>
          <button className="primary" type="button" onClick={()=>commit(()=>
            deleteCollectionTree(state,pending.id),'Collection deleted',()=>setDeleteId(null))}>Delete collection</button>
        </div>
      </div>
    </div>}
  </details>;
}
