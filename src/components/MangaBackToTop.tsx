import {useEffect,useState} from 'react';
import {ArrowUpIcon} from './SharedLibraryIcons';

/** Direct port of Novel Library's route-independent return-to-top control. */
export function MangaBackToTop(){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  const update=()=>setVisible(window.scrollY>420);
  update();
  window.addEventListener('scroll',update,{passive:true});
  return ()=>window.removeEventListener('scroll',update);
 },[]);
 if(!visible)return null;
 return <button type="button" className="page-top-button"
  title="Back to top" aria-label="Back to top"
  onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}>
  <ArrowUpIcon size={20}/>
 </button>;
}
