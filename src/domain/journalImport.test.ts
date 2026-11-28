import {describe,it,expect} from 'vitest';
import {parseCsv,suggestMapping,mapCsvRow,previewCandidates,parseImportCandidates} from './journalImport';
describe('CSV import',()=>{
 it('handles quoted commas, escaped quotes, multiline notes and blank values',()=>{
  const f=parseCsv('\uFEFFTitle,Status,Rating,Notes\r\n"Series, A",Finished,,"hello ""world""\r\nagain"\r\nB,Reading,8,');
  const first=mapCsvRow(f.rows[0]!,suggestMapping(f.headers),f.headers.length);
  expect(first.fields).toMatchObject({title:'Series, A',status:'Completed',rating:null,notes:'hello "world"\r\nagain'});
  expect(f.rows[1]!.sourceRow).toBe(4);
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
