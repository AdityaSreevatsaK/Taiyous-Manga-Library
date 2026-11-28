import {describe,it,expect} from 'vitest';
import {parseCsv,suggestMapping,mapCsvRow,previewCandidates,parseImportCandidates} from './journalImport';
describe('CSV import',()=>{
 it('handles quoted commas, escaped quotes, multiline notes and blank values',()=>{
  const f=parseCsv('\uFEFFTitle,Status,Rating,Notes\r\n"Series, A",Finished,,"hello ""world""\r\nagain"\r\nB,Reading,8,');
  const first=mapCsvRow(f.rows[0]!,suggestMapping(f.headers),f.headers.length);
  expect(first.fields).toMatchObject({title:'Series, A',status:'Completed',rating:null,notes:'hello "world"\r\nagain'});
  expect(f.rows[1]!.sourceRow).toBe(4);
 });
 it('allows clearing optional mappings without invalidating rows',()=>{
  const f=parseCsv('Title,Status,Rating\nA,Reading,8');
  expect(mapCsvRow(f.rows[0]!,{...suggestMapping(f.headers),rating:undefined},f.headers.length).fields?.rating).toBeNull();
 });
 it('rejects malformed CSV, unknown statuses, formula-like values and invalid integers',()=>{
  expect(()=>parseCsv('Title,Status\n"bad,Reading')).toThrow();
  for(const line of ['=SUM(1),Reading,8','A,unknown,8','A,Reading,1.5','A,Reading,-1']){
   const f=parseCsv('Title,Status,Rating\n'+line);
   expect(mapCsvRow(f.rows[0]!,suggestMapping(f.headers),f.headers.length).status).toBe('invalid');
  }
 });
 it('flags possible existing and within-batch duplicates without merging',()=>{
  const f=parseCsv('Title,Status\nA,Reading\na,Finished\nB,Reading');
  const rows=f.rows.map(row=>mapCsvRow(row,suggestMapping(f.headers),f.headers.length));
  const candidates=parseImportCandidates(rows.map(x=>({sourceRow:x.sourceRow,fields:x.fields})));
  expect(previewCandidates(candidates,[{title:'Other',alternativeTitles:['B']}]).map(x=>x.status)).toEqual(['conflict','conflict','conflict']);
 });
});

describe('legacy reading-list mapping',()=>{
 it('distinguishes publication from personal status and preserves fractional labels',()=>{
  const headers=['Sl. No','Name','Status','Reading status','Last Read','Opinion'];
  const mapping=suggestMapping(headers);
  expect(mapping).toEqual({title:1,publicationStatus:2,status:3,lastReadChapter:4,notes:5});
  expect(mapCsvRow({sourceRow:4,cells:['1','Synthetic','Completed','Started','12.5','Synthetic note']},mapping,6).fields)
   .toMatchObject({status:'Reading',publicationStatus:'completed',lastReadChapter:'12.5',chaptersRead:null,rating:null,notes:'Synthetic note'});
  expect(mapCsvRow({sourceRow:5,cells:['2','Synthetic','Completed','','','']},mapping,6).status).toBe('invalid');
  expect(mapCsvRow({sourceRow:6,cells:['3','Synthetic','Ongoing','Ongoing','','']},mapping,6).status).toBe('invalid');
 });
});

describe('owner-confirmed workbook conventions',()=>{
 it('applies blank and yellow rules only when enabled; never invents a rating',()=>{
  const mapping=suggestMapping(['Name','Status','Reading status','Last Read','Opinion']);
  const row={sourceRow:3,cells:['Synthetic title','Completed','','12.5',''],yellowColumns:[0]};
  const policy={blankMeansPlanToRead:true,yellowMeansFavourite:true};
  expect(mapCsvRow(row,mapping,5,policy).fields).toMatchObject({status:'Plan to Read',favourite:true,rating:null,lastReadChapter:'12.5'});
  expect(mapCsvRow(row,mapping,5).status).toBe('invalid');
  expect(mapCsvRow({...row,cells:['Synthetic title','Completed','?','','']},mapping,5,policy).status).toBe('invalid');
  expect(mapCsvRow({...row,cells:['Synthetic title','Completed','-','','']},mapping,5,policy).status).toBe('invalid');
  expect(mapCsvRow({...row,yellowColumns:[1]},mapping,5,policy).fields?.favourite).toBe(false);
 });
});
