import {describe,expect,it} from 'vitest';
import {parseJournalFields,parseJournalRecord} from './journal';
const base={title:'Synthetic Series',status:'Plan to Read'};
describe('independent Journal contract',()=>{
 it('preserves unknown counts, optional links and explicit reading status',()=>{
   expect(parseJournalFields(base)).toMatchObject({totalChapters:null,chaptersRead:null,rating:null,type:null,readingLinks:[],status:'Plan to Read'});
   expect(parseJournalFields({...base,chaptersRead:0,rating:10}).chaptersRead).toBe(0);
 });
 it.each([{rating:0},{rating:1.5},{rating:'8'},{totalChapters:-1},{chaptersRead:''},{status:'ongoing'},
   {startedOn:'2026-02-30'},{startedOn:'2026-05-02',finishedOn:'2026-05-01'},
   {readingLinks:['javascript:alert(1)']},{readingLinks:['https://user:pass@example.com']},
   {libraryMangaId:'ch_abcdefgh'},{publicationStatus:'invalid'},{favourite:'true'}])('rejects invalid fields %j',patch=>{
   expect(()=>parseJournalFields({...base,...patch})).toThrow();
 });
 it('rejects invalid persisted identities and missing fields',()=>{
   const t='2026-01-01T00:00:00.000Z';
   const record={...parseJournalFields(base),schemaVersion:1,id:'jrn_'+'a'.repeat(32),revision:1,createdAt:t,updatedAt:t,deletedAt:null};
   expect(parseJournalRecord(record)).toEqual(record);
   expect(()=>parseJournalRecord({...record,id:'mng_abcdefgh'})).toThrow();
   expect(()=>parseJournalRecord({...record,revision:0})).toThrow();
   const {notes,...incomplete}=record;
   expect(()=>parseJournalRecord(incomplete)).toThrow();
 });
});
