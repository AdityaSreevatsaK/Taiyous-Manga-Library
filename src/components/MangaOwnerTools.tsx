import { useEffect, useRef } from 'react';
import { ChevronDownIcon, LockKeyholeIcon, PlusIcon } from './SharedLibraryIcons';

/** Master shows only owner-verified, non-destructive actions.
 * Private manga uploads belong to the separately authorised Storage Controller.
 * UI visibility is convenience, not a server-side authorisation boundary.
 */
export function MangaOwnerTools({connected,owner,openPrivate}:{
  connected:boolean;owner?:string;openPrivate:()=>void;
}){
  const menu=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    function closeOutside(event:PointerEvent){
      if(menu.current?.open&&!menu.current.contains(event.target as Node))menu.current.open=false;
    }
    function closeEscape(event:KeyboardEvent){
      if(event.key==='Escape'&&menu.current?.open){
        menu.current.open=false;
        menu.current.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown',closeOutside);
    document.addEventListener('keydown',closeEscape);
    return()=>{
      document.removeEventListener('pointerdown',closeOutside);
      document.removeEventListener('keydown',closeEscape);
    };
  },[]);
  if(!connected)return null;
  return <>
    <details className="manga-master-menu" ref={menu}>
      <summary aria-label="Open Master Controls"><LockKeyholeIcon size={16}/>
        <span>Master</span><ChevronDownIcon size={12}/>
      </summary>
      <div className="manga-master-panel">
        <strong>Master controls</strong>
        <p>Connected as {owner||'the verified owner'}.</p>
        <button type="button" onClick={()=>{
          openPrivate();if(menu.current)menu.current.open=false;
        }}>Open my private library</button>
        <a href="https://huggingface.co/datasets/AdityaSreevatsaK/Taiyous-Manga"
          target="_blank" rel="noopener noreferrer">View private dataset</a>
        <a href="https://github.com/AdityaSreevatsaK/Taiyou-Manga-Storage-Controller"
          target="_blank" rel="noopener noreferrer">Manga Storage Controller</a>
        <p className="manga-master-note">Uploads, metadata edits and deletion are managed by the Storage Controller, not this website.</p>
      </div>
    </details>
    <a className="manga-nav-manage" href="https://github.com/AdityaSreevatsaK/Taiyou-Manga-Storage-Controller/actions"
      target="_blank" rel="noopener noreferrer"
      title="Open GitHub Actions in the Manga Storage Controller to manage uploads">
      <PlusIcon size={16}/><span>Manage manga</span>
    </a>
  </>;
}
