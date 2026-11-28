/** Independent cloud Journal contract; never a catalogue or local-progress record. */
export const JOURNAL_STATUSES=['Completed','Reading','Dropped','On Hold','Plan to Read'] as const;
export const JOURNAL_TYPES=['manga','manhwa','manhua','other'] as const;
export type JournalStatus=typeof JOURNAL_STATUSES[number];
export type JournalType=typeof JOURNAL_TYPES[number];
export interface JournalFields {
 title:string; status:JournalStatus; type:JournalType|null;
 alternativeTitles:string[]; authors:string[]; artists:string[]; tags:string[];
 totalChapters:number|null; chaptersRead:number|null; rating:number|null;
 favourite:boolean; startedOn:string|null; finishedOn:string|null; notes:string|null;
 externalIds:{provider:string;id:string}[]; readingLinks:string[]; libraryMangaId:string|null;
}
export interface JournalRecord extends JournalFields {
 schemaVersion:1; id:string; revision:number; createdAt:string; updatedAt:string; deletedAt:string|null;
}
export const JOURNAL_ID=/^jrn_[0-9a-f]{32}$/;
const MANGA_ID=/^mng_[A-Za-z0-9_-]{8,64}$/;
const KEYS=['title','status','type','alternativeTitles','authors','artists','tags','totalChapters','chaptersRead','rating','favourite','startedOn','finishedOn','notes','externalIds','readingLinks','libraryMangaId'] as const;
function object(v:unknown):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Expected an object');
 return v as Record<string,unknown>;
}
function str(v:unknown,max:number,multiline=false):string{
 if(typeof v!=='string'||!v.trim()||v.length>max||
 (multiline? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u : /[\u0000-\u001f\u007f]/u).test(v))throw Error('Invalid text');
 return v.trim().normalize('NFC');
}
function list(v:unknown,max=24):string[]{
 if(v===undefined)return [];
 if(!Array.isArray(v)||v.length>max)throw Error('Invalid list');
 const values=v.map(x=>str(x,180));
 if(new Set(values.map(x=>x.toLocaleLowerCase('en'))).size!==values.length)throw Error('Duplicate list values');
 return values;
}
function numberOrNull(v:unknown,min:number,max:number):number|null{
 if(v===null||v===undefined)return null;
 if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw Error('Invalid number');
 return v;
}
function day(v:unknown):string|null{
 if(v===null||v===undefined)return null;
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))throw Error('Invalid date');
 const d=new Date(v+'T00:00:00.000Z');
 if(!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==v)throw Error('Invalid date');
 return v;
}
function timestamp(v:unknown):string{
 if(typeof v!=='string'||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)throw Error('Invalid timestamp');
 return v;
}
export function parseJournalFields(input:unknown):JournalFields{
 const o=object(input);
 if(Object.keys(o).some(k=>!(KEYS as readonly string[]).includes(k)))throw Error('Unknown journal field');
 if(!(JOURNAL_STATUSES as readonly unknown[]).includes(o.status))throw Error('Invalid reading status');
 const type=o.type??null;
 if(type!==null&&!(JOURNAL_TYPES as readonly unknown[]).includes(type))throw Error('Invalid manga type');
 const favourite=o.favourite===undefined?false:o.favourite;
 if(typeof favourite!=='boolean')throw Error('Invalid favourite');
 const startedOn=day(o.startedOn),finishedOn=day(o.finishedOn);
 if(startedOn&&finishedOn&&finishedOn<startedOn)throw Error('Finish precedes start');
 const libraryMangaId=o.libraryMangaId??null;
 if(libraryMangaId!==null&&(typeof libraryMangaId!=='string'||!MANGA_ID.test(libraryMangaId)))throw Error('Invalid library ID');
 const rawIds=o.externalIds===undefined?[]:o.externalIds;
 if(!Array.isArray(rawIds)||rawIds.length>16)throw Error('Invalid external IDs');
 const externalIds=rawIds.map(v=>{
   const x=object(v);if(Object.keys(x).sort().join(',')!=='id,provider')throw Error('Invalid external ID');
   return {provider:str(x.provider,48),id:str(x.id,128)};
 });
 if(new Set(externalIds.map(x=>JSON.stringify([x.provider.toLowerCase(),x.id]))).size!==externalIds.length)throw Error('Duplicate external ID');
 const rawLinks=o.readingLinks===undefined?[]:o.readingLinks;
 if(!Array.isArray(rawLinks)||rawLinks.length>12)throw Error('Invalid reading links');
 const readingLinks=rawLinks.map(v=>{
   const s=str(v,2048);const u=new URL(s);
   if(u.protocol!=='https:'||u.username||u.password)throw Error('Only uncredentialled HTTPS links are supported');
   return u.href;
 });
 if(new Set(readingLinks).size!==readingLinks.length)throw Error('Duplicate reading link');
 const notes=o.notes===null||o.notes===undefined?null:str(o.notes,5000,true);
 return {title:str(o.title,240),status:o.status as JournalStatus,type:type as JournalType|null,
   alternativeTitles:list(o.alternativeTitles),authors:list(o.authors),artists:list(o.artists),tags:list(o.tags),
   totalChapters:numberOrNull(o.totalChapters,0,1000000),chaptersRead:numberOrNull(o.chaptersRead,0,1000000),
   rating:numberOrNull(o.rating,1,10),favourite,startedOn,finishedOn,notes,externalIds,readingLinks,libraryMangaId};
}
export function parseJournalRecord(input:unknown):JournalRecord{
 const {schemaVersion,id,revision,createdAt,updatedAt,deletedAt,...fields}=object(input);
 if(schemaVersion!==1||typeof id!=='string'||!JOURNAL_ID.test(id)||
 typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<1)throw Error('Invalid journal identity');
 if(KEYS.some(k=>!Object.hasOwn(fields,k)))throw Error('Incomplete persisted record');
 const created=timestamp(createdAt),updated=timestamp(updatedAt),deleted=deletedAt===null?null:timestamp(deletedAt);
 if(updated<created||(deleted!==null&&(deleted<created||deleted>updated)))throw Error('Invalid record chronology');
 return {...parseJournalFields(fields),schemaVersion:1,id,revision,createdAt:created,updatedAt:updated,deletedAt:deleted};
}
export function journalFields(record:JournalRecord):JournalFields{
 const {schemaVersion,id,revision,createdAt,updatedAt,deletedAt,...fields}=record;
 return fields;
}
