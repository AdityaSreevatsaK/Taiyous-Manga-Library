import {useState} from 'react';
import {novelHeroBackdrop,novelHeroBackdropUrl,novelHeroStyle} from '../domain/novelHero';

/** Exact Novel Library editorial backdrop selector and source policy.
 * This is decorative imagery, not private manga content.
 */
export function MangaHeroBackdrop({mangaId}:{mangaId:string}){
 const [failed,setFailed]=useState(false);
 const choice=novelHeroBackdrop(mangaId);
 return <div className="manga-novel-backdrop" style={novelHeroStyle(mangaId)} aria-hidden="true">
  {!failed&&<img className="details-hero-backdrop"
    src={novelHeroBackdropUrl(choice.photoId)}
    srcSet={`${novelHeroBackdropUrl(choice.photoId,840)} 840w, ${novelHeroBackdropUrl(choice.photoId,1500)} 1500w`}
    sizes="(max-width:700px) 100vw, 1200px" alt="" loading="lazy"
    decoding="async" fetchPriority="low" referrerPolicy="no-referrer" draggable={false}
    style={{objectPosition:choice.position}} onError={()=>setFailed(true)}/>}
 </div>;
}
