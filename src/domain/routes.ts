import type {MangaEntry,MangaChapter} from './types';
/** Public-facing readable routes are resolved against authenticated catalogue metadata.
 * No storage identity changes: every route resolves to immutable manga/chapter IDs.
 */
export const CATALOGUE_SECTIONS=['home','reading','trying','offline','finished','to-read','library','analytics'] as const;
export type CatalogueSection=typeof CATALOGUE_SECTIONS[number];
/** Six visible shelves; legacy To Be Read and Analytics URLs remain compatible. */
export const PRIMARY_NAV_SECTIONS=['home','reading','trying','offline','finished','library'] as const satisfies readonly CatalogueSection[];
export type AppRoute=
 | {kind:CatalogueSection}
 | {kind:'master';view?:'analytics'}
 | {kind:'journal'}
 | {kind:'details';mangaId:string}
 | {kind:'reader';mangaId:string;chapterId:string;pageIndex:number}
 | {kind:'not-found'};
const validSegment=/^[A-Za-z0-9_-]{1,128}$/;
const canonicalSlug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function prefixFor(basePath:string){
 return ('/'+basePath.split('/').filter(Boolean).join('/')).replace(/^\/$/,'');
}
function readSegment(encoded:string):string|null{
 try{const decoded=decodeURIComponent(encoded);
   return validSegment.test(decoded)?decoded:null;
 }catch{return null;}
}
export function slugify(value:string):string{
 const result=value.normalize('NFKD').toLocaleLowerCase('en')
   .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')
   .replace(/^-+|-+$/g,'');
 return result.slice(0,100).replace(/-+$/,'')||'untitled';
}
/** Controller-supplied, immutable catalogue slugs take precedence over titles.
 * Titles only supply a readable legacy fallback for pre-migration datasets.
 */
function seriesSlug(entry:MangaEntry){return entry.slug&&canonicalSlug.test(entry.slug)?entry.slug:slugify(entry.title);}
function chapterSlug(chapter:MangaChapter){
 return chapter.slug&&canonicalSlug.test(chapter.slug)?chapter.slug:slugify(chapter.label);
}
function uniqueSlug(base:string,identifier:string,duplicates:boolean){
 return duplicates?base+'--'+identifier.slice(-8).toLowerCase():base;
}
export function publicSeriesSlug(entry:MangaEntry,entries:readonly MangaEntry[]):string{
 const slug=seriesSlug(entry);
 return uniqueSlug(slug,entry.id,entries.some(other=>other.id!==entry.id&&seriesSlug(other)===slug));
}
export function publicChapterSlug(chapter:MangaChapter,entry:MangaEntry):string{
 const slug=chapterSlug(chapter);
 return uniqueSlug(slug,chapter.id,entry.chapters.some(other=>other.id!==chapter.id&&chapterSlug(other)===slug));
}
export function isCatalogueSection(kind:AppRoute['kind']):kind is CatalogueSection{
 return (CATALOGUE_SECTIONS as readonly string[]).includes(kind);
}
export function parseAppRoute(pathname:string,search='',basePath='/'):AppRoute{
 const prefix=prefixFor(basePath);
 if(prefix&&pathname!==prefix&&!pathname.startsWith(prefix+'/'))return {kind:'not-found'};
 const relative=prefix?pathname.slice(prefix.length):pathname;
 const parts=relative.split('/').filter(Boolean);
 if(parts.length===0)return {kind:'home'};
 if(parts.length===1&&parts[0]==='journal')return {kind:'journal'};
 if(parts.length===1&&parts[0]==='master')return new URLSearchParams(search).get('view')==='analytics'
   ?{kind:'master',view:'analytics'}:{kind:'master'};
 // Old bookmarks stay useful without restoring either removed navigation tab.
 if(parts.length===1&&parts[0]==='analytics')return {kind:'master',view:'analytics'};
 if(parts.length===1&&parts[0]==='to-read')return {kind:'library'};
 if(parts.length===1&&CATALOGUE_SECTIONS.includes(parts[0] as CatalogueSection)&&parts[0]!=='home')
   return {kind:parts[0] as CatalogueSection};
 if(parts[0]!=='manga')return {kind:'not-found'};
 if(parts.length===2){
   const segment=readSegment(parts[1]!);
   return segment?{kind:'details',mangaId:segment}:{kind:'not-found'};
 }
 if(parts.length===4&&parts[2]==='chapters'){
   const manga=readSegment(parts[1]!),chapter=readSegment(parts[3]!);
   const parameters=new URLSearchParams(search);
   const raw=parameters.get('page')??'1';
   const page=Number(raw);
   if(manga&&chapter&&/^\d+$/.test(raw)&&Number.isSafeInteger(page)&&page>=1){
     return {kind:'reader',mangaId:manga,chapterId:chapter,pageIndex:page-1};
   }
 }
 return {kind:'not-found'};
}
function matchUnique<T>(items:readonly T[],matches:(item:T)=>boolean):T|null{
 const results=items.filter(matches);
 return results.length===1?results[0]!:null;
}
/** Resolve old ID URLs, canonical immutable slugs and title aliases safely.
 * Ambiguous names return not-found instead of selecting the wrong private series.
 */
export function resolveAppRoute(route:AppRoute,entries:readonly MangaEntry[]):AppRoute{
 if(route.kind!=='details'&&route.kind!=='reader')return route;
 const manga=entries.find(e=>e.id===route.mangaId)??matchUnique(entries,e=>
   publicSeriesSlug(e,entries)===route.mangaId ||
   e.aliases.some(name=>slugify(name)===route.mangaId));
 if(!manga)return {kind:'not-found'};
 if(route.kind==='details')return {kind:'details',mangaId:manga.id};
 const chapter=manga.chapters.find(ch=>ch.id===route.chapterId)??matchUnique(manga.chapters,ch=>
   publicChapterSlug(ch,manga)===route.chapterId);
 if(!chapter)return {kind:'not-found'};
 return {kind:'reader',mangaId:manga.id,chapterId:chapter.id,pageIndex:route.pageIndex};
}
export function routeHref(route:Exclude<AppRoute,{kind:'not-found'}>,
 basePath='/',entries:readonly MangaEntry[]=[]):string{
 const base=prefixFor(basePath);
 if(route.kind==='home')return base+'/';
 if(route.kind==='master')return base+'/master'+(route.view==='analytics'?'?view=analytics':'');
 if(route.kind!=='details'&&route.kind!=='reader')return base+'/'+route.kind;
 const entry=entries.find(e=>e.id===route.mangaId);
 const mangaSegment=entry?publicSeriesSlug(entry,entries):route.mangaId;
 const path=base+'/manga/'+encodeURIComponent(mangaSegment);
 if(route.kind==='details')return path;
 const chapter=entry?.chapters.find(ch=>ch.id===route.chapterId);
 const chapterSegment=entry&&chapter?publicChapterSlug(chapter,entry):route.chapterId;
 // Page 1 is the default, so do not clutter links with a redundant query.
 return path+'/chapters/'+encodeURIComponent(chapterSegment)+
   (route.pageIndex>0?'?page='+(route.pageIndex+1):'');
}
