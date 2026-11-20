import type { ReaderPreferences } from '../domain/localReaderStorage';

type Theme = ReaderPreferences['theme'];

/** Uses the exact same approved Taiyou Sun WebP assets as the Novel Library.
 * Source reference: Taiyous-Personal-Library/src/components/BrandMark.tsx
 * No surrounding tile, border or duplicate decorative artwork.
 */
export function MangaBrandMark({size=36,theme}:{size?:number;theme:Theme}){
  const variant=['sepia','paper','ocean'].includes(theme)?'light':'dark';
  return <img className="brand-sun taiyou-brand-mark"
    src={import.meta.env.BASE_URL+'branding/sun-'+variant+'.webp'}
    width={size} height={size} alt="" aria-hidden="true" draggable={false}
    style={{width:size,height:size}}/>;
}
