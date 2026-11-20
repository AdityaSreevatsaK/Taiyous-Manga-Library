import {useMemo,useState,type CSSProperties,type MouseEvent} from 'react';
import {ChevronDownIcon,LibraryIcon,SearchIcon} from './SharedLibraryIcons';

/** Port of Novel Library QuickNavigation.tsx for immutable manga and collection IDs. */
interface CollectionLink {id:string;name:string;path:string;count:number;parentId:string|null}
interface Props {
 collections:CollectionLink[];
 readingHref:string;allHref:string;searchHref:string;
 collectionHref:(id:string)=>string;
 onReading:()=>void;onAll:()=>void;onSearch:()=>void;onCollection:(id:string)=>void;
}
function follow(event:MouseEvent<HTMLAnchorElement>,action:()=>void){
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 event.preventDefault();action();
}
export function MangaDetailsQuickNav({collections,readingHref,allHref,searchHref,
 collectionHref,onReading,onAll,onSearch,onCollection}:Props){
 const [expanded,setExpanded]=useState(false);
 const links=useMemo(()=>{
  if(!expanded)return [] as Array<CollectionLink&{depth:number}>;
  const byId=new Map(collections.map(x=>[x.id,x]));
  return [...collections].sort((a,b)=>a.path.localeCompare(b.path)).map(item=>{
   let depth=0,cursor=item.parentId;
   const seen=new Set([item.id]);
   while(cursor&&byId.has(cursor)&&!seen.has(cursor)&&depth<7){
    seen.add(cursor);depth++;cursor=byId.get(cursor)!.parentId;
   }
   return {...item,depth};
  });
 },[collections,expanded]);
 const open=(action:()=>void)=>{setExpanded(false);action()};
 const items=()=>links.length?links.map(item=><a key={item.id}
   href={collectionHref(item.id)} className="quick-nav-collection-link"
   style={{paddingLeft:Math.min(item.depth,7)*15+12} as CSSProperties}
   aria-label={'Open collection '+item.path}
   onClick={event=>follow(event,()=>open(()=>onCollection(item.id)))}>
   <span>{item.name}</span><small>{item.count}</small>
 </a>):<p className="quick-nav-empty">No collections yet</p>;
 return <nav className="quick-nav manga-detail-quick-nav" aria-label="Navigate library">
  <div className="quick-nav-primary">
   <a href={readingHref} onClick={event=>follow(event,()=>open(onReading))}>Currently reading</a>
   <a href={allHref} onClick={event=>follow(event,()=>open(onAll))}>All manga</a>
   <details className="quick-nav-dropdown-host" onToggle={event=>setExpanded(event.currentTarget.open)}>
    <summary><LibraryIcon size={15}/> Collections <ChevronDownIcon size={13}/></summary>
    {expanded&&<div className="quick-nav-popover" role="group" aria-label="Collections and subcollections">
      <strong>YOUR COLLECTIONS</strong>{items()}
    </div>}
   </details>
   <a href={searchHref} className="quick-nav-search"
     onClick={event=>follow(event,()=>open(onSearch))}><SearchIcon size={16}/> Search</a>
  </div>
  <details className="quick-nav-mobile" onToggle={event=>setExpanded(event.currentTarget.open)}>
   <summary aria-label="Open library navigation"><LibraryIcon size={17}/>
    <span>Library</span><ChevronDownIcon size={13}/></summary>
   {expanded&&<div className="quick-nav-popover" role="group" aria-label="Library shortcuts">
    <a href={allHref} onClick={event=>follow(event,()=>open(onAll))}>All manga</a>
    <a href={readingHref} onClick={event=>follow(event,()=>open(onReading))}>Currently reading</a>
    <a href={searchHref} onClick={event=>follow(event,()=>open(onSearch))}>Search library</a>
    <strong>COLLECTIONS</strong>{items()}
   </div>}
  </details>
 </nav>;
}
