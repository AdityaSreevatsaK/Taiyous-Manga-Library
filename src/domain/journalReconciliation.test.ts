import {describe,expect,it} from 'vitest';
import {archiveCandidates,annotationComparison} from './journalReconciliation';
import {parseJournalFields,type JournalRecord} from './journal';
import type {MangaEntry} from './types';
const a:MangaEntry={kind:'manga',id:'mng_synthetic1',title:'Synthetic First',aliases:['Alternative Name'],creators:[],tags:[],publicationStatus:'unknown',direction:'rtl',chapters:[]};
const b:MangaEntry={...a,id:'mng_synthetic2',title:'Alternative Name',aliases:[]};
const fields=parseJournalFields({title:'alternative-name',status:'Reading',rating:8,favourite:true});
describe('review-only archive reconciliation',()=>{
 it('suggests exact normalised title or alias matches, never silently selects ambiguous entries',()=>{
  const used={...fields,libraryMangaId:a.id,schemaVersion:1,id:'jrn_'+'a'.repeat(32),revision:1,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',deletedAt:null} as JournalRecord;
  expect(archiveCandidates(fields,[a,b],[used]).map(x=>[x.entry.id,x.occupied])).toEqual([[a.id,true],[b.id,false]]);
  expect(archiveCandidates(fields,[a,b],[used],used.id)[0]?.occupied).toBe(false);
  expect(archiveCandidates(parseJournalFields({title:'Unrelated',status:'Reading'}),[a,b],[])).toEqual([]);
 });
 it('shows conflicts only for the currently linked immutable ID',()=>{
  const local={mangaId:a.id,rating:4,notes:'',tags:[],updatedAt:'2026-01-01T00:00:00.000Z'};
  expect(annotationComparison(fields,local)).toBeNull();
  expect(annotationComparison({...fields,libraryMangaId:a.id},local)).toEqual({
   rating:{journal:8,device:4,different:true},favourite:{journal:true,device:false,different:true}});
  expect(fields.rating).toBe(8);
 });
});
