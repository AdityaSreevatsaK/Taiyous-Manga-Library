import {useEffect,useRef} from 'react';

export interface CollectionChoice {
 id:string;
 label:string;
 selected:boolean;
}
export function MangaCollectionPicker({open,title,items,onToggle,onManage,onClose}:{
 open:boolean;title:string;items:readonly CollectionChoice[];
 onToggle:(collectionId:string,selected:boolean)=>void;
 onManage:()=>void;onClose:()=>void;
}){
 const closeButton=useRef<HTMLButtonElement>(null);
 const onCloseRef=useRef(onClose);
 onCloseRef.current=onClose;
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const raf=requestAnimationFrame(()=>closeButton.current?.focus());
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onCloseRef.current();return;}
   if(event.key==='Tab'){
    const nodes=Array.from(document.querySelectorAll<HTMLElement>(
      '.manga-collection-dialog button:not(:disabled),.manga-collection-dialog input:not(:disabled)'));
    if(!nodes.length)return;
    const first=nodes[0]!,last=nodes[nodes.length-1]!;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  };
  document.addEventListener('keydown',key,true);
  return ()=>{cancelAnimationFrame(raf);document.removeEventListener('keydown',key,true);previous?.focus();};
 },[open]);
 if(!open)return null;
 return <div className="manga-picker-shade" onMouseDown={event=>{
   if(event.target===event.currentTarget)onClose();
 }}>
  <section className="manga-chapter-dialog manga-collection-dialog"
    role="dialog" aria-modal="true" aria-label={'Collections for '+title}>
   <header className="manga-picker-header">
    <div><p className="manga-overline">YOUR ORGANISATION</p>
      <h2>Choose collections</h2><p>{title}</p></div>
    <button type="button" ref={closeButton} className="manga-picker-close"
      aria-label="Close collection picker" onClick={onClose}>×</button>
   </header>
   <div className="manga-picker-results manga-collection-options">
     {items.length ? items.map(item=><label className="manga-picker-result manga-collection-option"
       key={item.id}>
       <input type="checkbox" checked={item.selected}
         onChange={event=>onToggle(item.id,event.target.checked)}/>
       <span className="manga-picker-title">{item.label}</span>
       {item.selected&&<span className="manga-picker-current">Added</span>}
     </label>) :
     <p className="manga-picker-empty">No collections yet. Create one in All Manga.</p>}
   </div>
   <footer className="manga-picker-footer manga-collection-footer">
     <button type="button" className="secondary" onClick={onManage}>Manage collections</button>
     <button type="button" className="primary" onClick={onClose}>Done</button>
   </footer>
  </section>
 </div>;
}
