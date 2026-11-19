import { browserStorage } from './localReaderStorage';

const KEY = 'taiyou-manga:personal-collections:v1';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
export const MAX_COLLECTIONS = 500;
export interface UserCollection {
  id: string;
  name: string;
  parentId: string | null;
  mangaIds: string[];
}
export interface CollectionState {
  schemaVersion: 1;
  mediaKind: 'manga';
  revision: number;
  items: UserCollection[];
}
export const emptyCollections = (): CollectionState => ({
  schemaVersion:1, mediaKind:'manga', revision:0, items:[],
});
export type CollectionRead = {status:'ok';value:CollectionState} | {status:'invalid'|'unavailable'};
export type CollectionWrite = CollectionRead | {status:'stale'};
const object=(v:unknown):v is Record<string,unknown> =>
  v!==null && typeof v==='object' && !Array.isArray(v);
export function cleanCollectionName(value: string): string {
  const name=value.trim().replace(/\s+/gu,' ').normalize('NFC');
  if(!name || name.length>80 || /[\p{C}<>]/u.test(name)) throw new Error('Collection name must be 1–80 readable characters.');
  return name;
}
export function validateCollections(value:unknown):CollectionState {
  if(!object(value)||value.schemaVersion!==1||value.mediaKind!=='manga'||
     (typeof value.revision!=='number'||!Number.isSafeInteger(value.revision)||value.revision<0)||
     !Array.isArray(value.items)||value.items.length>MAX_COLLECTIONS)
    throw Error('Unsupported or oversized collection catalogue.');
  const ids=new Set<string>();
  const items:UserCollection[]=[];
  for(const record of value.items) {
    if(!object(record)||typeof record.id!=='string'||!ID.test(record.id)||ids.has(record.id)||
       typeof record.name!=='string'||!(record.parentId===null||
         (typeof record.parentId==='string'&&ID.test(record.parentId)))||
       !Array.isArray(record.mangaIds)||record.mangaIds.length>2000)
      throw Error('Invalid or duplicate personal collection.');
    const name=cleanCollectionName(record.name);
    const mangaIds=new Set<string>();
    for(const mangaId of record.mangaIds) {
      if(typeof mangaId!=='string'||!ID.test(mangaId)||mangaIds.has(mangaId))
        throw Error('Invalid or duplicate manga in collection.');
      mangaIds.add(mangaId);
    }
    ids.add(record.id);
    items.push({id:record.id,name,parentId:record.parentId,mangaIds:[...mangaIds]});
  }
  const byId=new Map(items.map(item=>[item.id,item]));
  const siblingNames=new Set<string>();
  for(const item of items) {
    if(item.parentId!==null&&!byId.has(item.parentId)) throw Error('Collection parent does not exist.');
    const key=(item.parentId??'_root')+'/'+item.name.toLocaleLowerCase('en');
    if(siblingNames.has(key)) throw Error('Duplicate collection name in the same folder.');
    siblingNames.add(key);
    const seen=new Set<string>();
    let cursor:UserCollection|undefined=item;
    while(cursor && cursor.parentId!==null) {
      if(seen.has(cursor.id)||cursor.parentId===item.id)
        throw Error('Collection nesting cannot contain a cycle.');
      seen.add(cursor.id);
      cursor=byId.get(cursor.parentId);
    }
  }
  return {schemaVersion:1,mediaKind:'manga',revision:value.revision as number,items};
}
export function loadCollections(store:Storage|null=browserStorage()):CollectionRead {
  if(!store) return {status:'unavailable'};
  try {
    const raw=store.getItem(KEY);
    return {status:'ok',value:raw===null?emptyCollections():validateCollections(JSON.parse(raw))};
  } catch {return {status:'invalid'};}
}
export function saveCollections(value:CollectionState,expectedRevision:number,
  store:Storage|null=browserStorage()):CollectionWrite {
  if(!store) return {status:'unavailable'};
  let checked:CollectionState;
  try {checked=validateCollections(value);}
  catch {return {status:'invalid'};}
  const current=loadCollections(store);
  if(current.status!=='ok') return current;
  if(current.value.revision!==expectedRevision) return {status:'stale'};
  if(checked.revision!==expectedRevision) return {status:'stale'};
  const next:CollectionState={...checked,revision:expectedRevision+1};
  try {store.setItem(KEY,JSON.stringify(next));return {status:'ok',value:next};}
  catch {return {status:'unavailable'};}
}
function withItems(state:CollectionState,items:UserCollection[]):CollectionState {
  return validateCollections({...state,items});
}
function requireCollection(state:CollectionState,id:string):UserCollection {
  const found=state.items.find(item=>item.id===id);
  if(!found) throw Error('Collection not found.');
  return found;
}
export function createCollection(state:CollectionState,id:string,name:string,
  parentId:string|null=null):CollectionState {
  if(!ID.test(id)||state.items.some(item=>item.id===id)) throw Error('Collection ID already exists or is invalid.');
  if(parentId!==null) requireCollection(state,parentId);
  return withItems(state,[...state.items,{id,name:cleanCollectionName(name),parentId,mangaIds:[]}]);
}
export function renameCollection(state:CollectionState,id:string,name:string):CollectionState {
  requireCollection(state,id);
  return withItems(state,state.items.map(item=>item.id===id?
    {...item,name:cleanCollectionName(name)}:item));
}
export function moveCollection(state:CollectionState,id:string,parentId:string|null):CollectionState {
  requireCollection(state,id);
  if(parentId!==null) requireCollection(state,parentId);
  return withItems(state,state.items.map(item=>item.id===id?{...item,parentId}:item));
}
/** Explicitly confirmed removal of a collection subtree, never manga or their progress. */
export function deleteCollectionTree(state:CollectionState,id:string):CollectionState {
  requireCollection(state,id);
  const removed=new Set<string>([id]);
  let changed=true;
  while(changed) {
    changed=false;
    for(const item of state.items) if(item.parentId && removed.has(item.parentId) && !removed.has(item.id)) {
      removed.add(item.id);changed=true;
    }
  }
  return withItems(state,state.items.filter(item=>!removed.has(item.id)));
}
export function setCollectionMembership(state:CollectionState,id:string,mangaId:string,add:boolean):CollectionState {
  requireCollection(state,id);
  if(!ID.test(mangaId)) throw Error('Invalid manga ID.');
  return withItems(state,state.items.map(item=>item.id===id?{
    ...item, mangaIds:add?
      [...new Set([...item.mangaIds,mangaId])]:
      item.mangaIds.filter(existing=>existing!==mangaId),
  }:item));
}
export function collectionBreadcrumb(state:CollectionState,id:string):string {
  const names:string[]=[];
  let current:UserCollection|undefined=requireCollection(state,id);
  const seen=new Set<string>();
  while(current) {
    if(seen.has(current.id))throw Error('Collection nesting cycle.');
    seen.add(current.id);
    names.unshift(current.name);
    current=current.parentId?state.items.find(item=>item.id===current!.parentId):undefined;
  }
  return names.join(' / ');
}
export function countCollectionDescendants(state:CollectionState,id:string):number {
  return state.items.filter(item=>{
    let parent=item.parentId;
    while(parent) {
      if(parent===id)return true;
      parent=state.items.find(ancestor=>ancestor.id===parent)?.parentId??null;
    }
    return false;
  }).length;
}
