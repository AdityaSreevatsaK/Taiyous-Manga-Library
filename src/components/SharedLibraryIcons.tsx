import type { SVGProps } from 'react';

/** Same Lucide icon glyphs used by Taiyou's Personal Library.
 * Inlined so the Manga Library keeps its small dependency/bundle footprint.
 */
type Props=SVGProps<SVGSVGElement>&{size?:number};
function Icon({size=16,children,...props}:Props){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" {...props}>{children}</svg>;
}
export function CloudIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 16.25"/><path d="M8 16h12"/></Icon>;
}
export function SearchIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></Icon>;
}
export function HashIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="M4 9h16M4 15h16M11 3 7 21M17 3l-4 18"/></Icon>;
}
export function LibraryIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="m16 6 4 14M12 6v14M8 8v12M4 4v16"/></Icon>;
}
export function ChevronDownIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="m6 9 6 6 6-6"/></Icon>;
}
export function LockKeyholeIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><rect width="18" height="12" x="3" y="10" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/><circle cx="12" cy="16" r="1"/></Icon>;
}
export function PlusIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="M12 5v14M5 12h14"/></Icon>;
}
