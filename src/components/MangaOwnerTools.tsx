import type {MouseEvent} from 'react';
import {LockKeyholeIcon} from './SharedLibraryIcons';

/** Direct, bookmarkable Master Controls navigation. The separate Manage manga
 * link and the small dropdown are deliberately removed. */
export function MangaOwnerTools({connected,href,onOpen,active=false}:{
 connected:boolean;href:string;active?:boolean;
 onOpen:(event:MouseEvent<HTMLAnchorElement>)=>void;
}){
 return <a className="manga-master-entry" href={href}
   title={connected?'Open Master Controls and Analytics':'View Analytics or sign in for owner administration'}
   aria-current={active?'page':undefined} onClick={onOpen}>
   <LockKeyholeIcon size={16}/><span>Master</span>
 </a>;
}
