import type {JournalFields,JournalRecord} from './journal';
import type {MangaEntry} from './types';
import type {PersonalAnnotation} from './personalAnnotations';
import {normaliseImportTitle} from './journalImport';
export interface ArchiveCandidate {entry:MangaEntry;occupied:boolean}
export function archiveCandidates(fields:JournalFields,archive:readonly MangaEntry[],records:readonly JournalRecord[],editingId?:string):ArchiveCandidate[]{
 const names=new Set([fields.title,...fields.alternativeTitles].map(normaliseImportTitle).filter(Boolean));
 const occupied=new Set(records.filter(x=>x.id!==editingId&&x.deletedAt===null&&x.libraryMangaId).map(x=>x.libraryMangaId));
 return archive.filter(entry=>[entry.title,...entry.aliases].some(name=>names.has(normaliseImportTitle(name))))
  .map(entry=>({entry,occupied:occupied.has(entry.id)}));
}
export function annotationComparison(fields:JournalFields,annotation?:PersonalAnnotation){
 if(!annotation||annotation.mangaId!==fields.libraryMangaId)return null;
 return {rating:{journal:fields.rating,device:annotation.rating,different:fields.rating!==annotation.rating},
  favourite:{journal:fields.favourite,device:!!annotation.favourite,different:fields.favourite!==!!annotation.favourite}};
}
