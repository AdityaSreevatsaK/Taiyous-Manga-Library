import type { MangaEntry, MangaProgress } from './types';
import type { PersonalShelf } from './personalShelves';
import type { PersonalAnnotation } from './personalAnnotations';

export type ReadingStateFilter = 'any'|'reading'|'trying'|'finished'|'to-read'|'unstarted';
export type OfflineStateFilter = 'any'|'downloaded'|'not-downloaded';
export interface AdvancedCriteria {
  creator: string;
  minChapters: number | null;
  maxChapters: number | null;
  minPersonalRating: number | null;
  readingState: ReadingStateFilter;
  offlineState: OfflineStateFilter;
}
export const defaultAdvancedCriteria = (): AdvancedCriteria => ({
  creator:'',minChapters:null,maxChapters:null,minPersonalRating:null,
  readingState:'any',offlineState:'any',
});
export interface ReadingContext {
  progress: Readonly<Record<string,MangaProgress>>;
  shelves: Readonly<Record<string,PersonalShelf>>;
  annotations: Readonly<Record<string,PersonalAnnotation>>;
  offlineChapterIds: ReadonlySet<string>;
}
export function hasOfflineChapter(entry:MangaEntry,ids:ReadonlySet<string>):boolean {
  return entry.chapters.some(chapter=>ids.has(chapter.id));
}
export function isCurrentlyReading(entry:MangaEntry,context:ReadingContext):boolean {
  return !!context.progress[entry.id] &&
    !['finished','trying','to-read'].includes(context.shelves[entry.id]??'');
}
function matchesState(entry:MangaEntry,state:ReadingStateFilter,context:ReadingContext):boolean {
  const shelf=context.shelves[entry.id];
  if(state==='any')return true;
  if(state==='reading')return isCurrentlyReading(entry,context);
  if(state==='unstarted')return !context.progress[entry.id];
  return shelf===state;
}
/** Compound device-local discovery, never sends a query or metadata to an external provider. */
export function applyAdvancedDiscovery(entries:readonly MangaEntry[],criteria:AdvancedCriteria,
  context:ReadingContext):MangaEntry[] {
  if((criteria.minChapters!==null&&(!Number.isSafeInteger(criteria.minChapters)||criteria.minChapters<0))||
     (criteria.maxChapters!==null&&(!Number.isSafeInteger(criteria.maxChapters)||criteria.maxChapters<0))||
     (criteria.minPersonalRating!==null&&(!Number.isInteger(criteria.minPersonalRating)||
       criteria.minPersonalRating<1||criteria.minPersonalRating>10))||
     (criteria.minChapters!==null&&criteria.maxChapters!==null&&criteria.minChapters>criteria.maxChapters))
    return [];
  const creator=criteria.creator.trim().normalize('NFKC').toLocaleLowerCase();
  return entries.filter(entry=>
    (!creator||[...entry.creators,...(entry.creatorRoles??[]).map(person=>person.name)]
      .some(name=>name.normalize('NFKC').toLocaleLowerCase().includes(creator)))&&
    (criteria.minChapters===null||entry.chapters.length>=criteria.minChapters)&&
    (criteria.maxChapters===null||entry.chapters.length<=criteria.maxChapters)&&
    (criteria.minPersonalRating===null||(context.annotations[entry.id]?.rating??0)>=criteria.minPersonalRating)&&
    matchesState(entry,criteria.readingState,context)&&
    (criteria.offlineState==='any'||
      (criteria.offlineState==='downloaded')===hasOfflineChapter(entry,context.offlineChapterIds))
  );
}
export interface RecentReadingEntry {
  mangaId:string;
  title:string;
  chapter:string;
  page:number;
  savedAt:string;
}
export function computeLocalReadingAnalytics(entries:readonly MangaEntry[],context:ReadingContext) {
  const started=entries.filter(item=>!!context.progress[item.id]);
  const reading=entries.filter(item=>isCurrentlyReading(item,context));
  const ratings=entries.map(item=>context.annotations[item.id]?.rating??null)
    .filter((value):value is number=>value!==null);
  const avgRating=ratings.length?Math.round(ratings.reduce((a,b)=>a+b,0)*10/ratings.length)/10:null;
  const genreCount=new Map<string,number>();
  for(const item of reading)for(const genre of item.tags)genreCount.set(genre,(genreCount.get(genre)??0)+1);
  const genres=[...genreCount].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .map(([name,count])=>({name,count}));
  const recent:RecentReadingEntry[]=started.map(item=>{
    const record=context.progress[item.id]!;
    return {mangaId:item.id,title:item.title,chapter:item.chapters.find(c=>c.id===record.chapterId)?.label??'Unknown chapter',
      page:record.pageIndex+1,savedAt:record.updatedAt};
  }).sort((a,b)=>Date.parse(b.savedAt)-Date.parse(a.savedAt));
  return {
    total:entries.length,
    started:started.length,
    reading:reading.length,
    trying:entries.filter(item=>context.shelves[item.id]==='trying').length,
    finished:entries.filter(item=>context.shelves[item.id]==='finished').length,
    toRead:entries.filter(item=>context.shelves[item.id]==='to-read').length,
    downloadedChapters:context.offlineChapterIds.size,
    offlineSeries:entries.filter(item=>hasOfflineChapter(item,context.offlineChapterIds)).length,
    rated:ratings.length,
    avgRating,
    ratingsDistribution:Array.from({length:10},(_,i)=>({
      score:i+1,count:ratings.filter(value=>value===i+1).length,
    })),
    genres,recent,
  };
}
