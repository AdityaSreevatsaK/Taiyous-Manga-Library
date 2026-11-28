import {parseJournalRecord,type JournalRecord} from './journal';
export const BACKUP_LIMIT=10000;
export const BACKUP_BYTES=20*1024*1024;
export interface JournalBackup {format:'taiyou-manga-journal';schemaVersion:1;exportedAt:string;entries:JournalRecord[]}
export function parseBackupEntries(raw:unknown,max=BACKUP_LIMIT):JournalRecord[]{
 if(!Array.isArray(raw)||raw.length>max)throw Error('Invalid backup entry count');
 const entries=raw.map(parseJournalRecord),ids=new Set<string>(),links=new Set<string>();
 for(const entry of entries){
  if(ids.has(entry.id))throw Error('Duplicate record ID in backup');
  ids.add(entry.id);
  if(entry.deletedAt===null&&entry.libraryMangaId){
   if(links.has(entry.libraryMangaId))throw Error('Duplicate active archive link in backup');
   links.add(entry.libraryMangaId);
  }
 }
 return entries;
}
export function parseJournalBackup(raw:unknown):JournalBackup{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid backup');
 const o=raw as Record<string,unknown>;
 if(Object.keys(o).sort().join(',')!=='entries,exportedAt,format,schemaVersion'||o.format!=='taiyou-manga-journal'||o.schemaVersion!==1||
  typeof o.exportedAt!=='string'||!Number.isFinite(Date.parse(o.exportedAt))||new Date(o.exportedAt).toISOString()!==o.exportedAt)throw Error('Unsupported backup format');
 return {format:'taiyou-manga-journal',schemaVersion:1,exportedAt:o.exportedAt,entries:parseBackupEntries(o.entries)};
}
export interface RecoveryRow {id:string;status:'addition'|'unchanged'|'conflict';reason?:string}
export function recoveryPreview(incoming:JournalRecord[],existing:JournalRecord[]):RecoveryRow[]{
 const ids=new Map(existing.map(x=>[x.id,x]));
 const links=new Map(existing.filter(x=>x.deletedAt===null&&x.libraryMangaId).map(x=>[x.libraryMangaId,x.id]));
 return incoming.map(entry=>{
  const current=ids.get(entry.id);
  if(current)return {id:entry.id,status:JSON.stringify(current)===JSON.stringify(entry)?'unchanged':'conflict',reason:JSON.stringify(current)===JSON.stringify(entry)?undefined:'Existing ID has different data; never overwritten'};
  if(entry.deletedAt===null&&entry.libraryMangaId&&links.has(entry.libraryMangaId))return {id:entry.id,status:'conflict',reason:'Active archive link already assigned'};
  return {id:entry.id,status:'addition'};
 });
}
