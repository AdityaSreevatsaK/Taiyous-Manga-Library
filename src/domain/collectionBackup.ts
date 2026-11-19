import { loadCollections, saveCollections, validateCollections,
  type CollectionState } from './personalCollections';

/** Non-destructive union by stable collection ID. Existing records always win. */
export function planCollectionMerge(localInput:CollectionState,incomingInput:CollectionState) {
  let state=validateCollections(localInput);
  const incoming=validateCollections(incomingInput);
  let added=0,skipped=0;
  let pending=[...incoming.items];
  while(pending.length) {
    const later:typeof pending=[];
    let advanced=false;
    for(const record of pending) {
      if(state.items.some(existing=>existing.id===record.id)) {skipped++;advanced=true;continue;}
      if(record.parentId && !state.items.some(parent=>parent.id===record.parentId)) {
        later.push(record);continue;
      }
      try {
        state=validateCollections({...state,items:[...state.items,record]});
        added++;advanced=true;
      } catch {
        // A sibling with the same name or full store is a conflict, not a reason to overwrite.
        skipped++;advanced=true;
      }
    }
    if(!advanced){skipped+=later.length;break;}
    pending=later;
  }
  return {state,added,skipped};
}
export function importCollectionMerge(incoming:CollectionState,store:Storage|null) {
  const current=loadCollections(store);
  if(current.status!=='ok')return {status:current.status as 'invalid'|'unavailable',added:0,skipped:0};
  let plan:ReturnType<typeof planCollectionMerge>;
  try {plan=planCollectionMerge(current.value,incoming);}
  catch {return {status:'invalid' as const,added:0,skipped:0};}
  if(!plan.added)return {status:'ok' as const,added:0,skipped:plan.skipped};
  const saved=saveCollections(plan.state,current.value.revision,store);
  return {
    status:saved.status,
    added:saved.status==='ok'?plan.added:0,
    skipped:plan.skipped,
  };
}
