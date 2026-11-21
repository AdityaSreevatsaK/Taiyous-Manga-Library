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
/** The same open-book chapter glyph displayed on Novel Library details. */
/** The bookmark-on-book chapter locator used by Novel Library. */
export function BookMarkedIcon(props:Omit<Props,'children'>){
 return <Icon {...props}><path d="M10 2v8l3-3 3 3V2"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></Icon>;
}
export function BookOpenIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="M12 7v14"/><path d="M3 18V5a2 2 0 0 1 2-2h3a4 4 0 0 1 4 4v14a4 4 0 0 0-4-4H5a2 2 0 0 0-2 2z"/><path d="M21 18V5a2 2 0 0 0-2-2h-3a4 4 0 0 0-4 4v14a4 4 0 0 1 4-4h3a2 2 0 0 1 2 2z"/></Icon>;
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
/** Lucide details card symbols, matching the Novel Library's exact SVG paths. */
export function BookmarkIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></Icon>;
}
export function InfoIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></Icon>;
}
export function TagIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="M12.586 3.586A2 2 0 0 0 11.172 3H4a1 1 0 0 0-1 1v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2 2 0 0 0 2.828 0l6.172-6.172a2 2 0 0 0 0-2.828z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></Icon>;
}
export function StarIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.165.751a.53.53 0 0 1 .294.904l-3.737 3.643a2.12 2.12 0 0 0-.609 1.878l.882 5.144a.53.53 0 0 1-.769.558l-4.62-2.429a2.12 2.12 0 0 0-1.973 0l-4.62 2.429a.53.53 0 0 1-.769-.558l.882-5.144a2.12 2.12 0 0 0-.609-1.878L2.161 9.79a.53.53 0 0 1 .294-.904l5.165-.751a2.12 2.12 0 0 0 1.595-1.16z"/></Icon>;
}
export function ListIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></Icon>;
}
export function Settings2Icon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="M14 17H5M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></Icon>;
}
export function PencilIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></Icon>;
}
export function PlusIcon(props:Omit<Props,'children'>){
  return <Icon {...props}><path d="M12 5v14M5 12h14"/></Icon>;
}
