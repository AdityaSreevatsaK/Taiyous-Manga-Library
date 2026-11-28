import {parseJournalFields,type JournalFields,type JournalRecord} from './journal';
export const IMPORT_BATCH_LIMIT=50;
export const IMPORT_COLUMNS=['title','status','type','authors','artists','alternativeTitles','tags','totalChapters','chaptersRead','rating','favourite','startedOn','finishedOn','notes','readingLinks'] as const;
export type ImportColumn=typeof IMPORT_COLUMNS[number];
export type Mapping=Partial<Record<ImportColumn,number>>;
export interface CsvRow {sourceRow:number;cells:string[]}
export interface ImportCandidate {sourceRow:number;fields:JournalFields}
export interface ImportPreviewRow {sourceRow:number;status:'addition'|'conflict'|'invalid';title:string;reason?:string;fields?:JournalFields}
export function parseCsv(text:string):{headers:string[];rows:CsvRow[]}{
 if(text.length>2*1024*1024)throw Error('CSV exceeds 2 MB');
 text=text.replace(/^\uFEFF/,'');
 const rows:CsvRow[]=[];let cells:string[]=[],value='',quoted=false,closed=false,row=1,start=1;
 function push(){cells.push(value);value='';closed=false;if(cells.length>100)throw Error('Too many columns');}
 function end(){push();if(cells.some(c=>c.trim()))rows.push({sourceRow:start,cells});cells=[];if(rows.length>5001)throw Error('Too many rows');}
 for(let i=0;i<text.length;i++){
  const c=text[i]!;
  if(quoted){
   if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}
   else {value+=c;if(c==='\n'||(c==='\r'&&text[i+1]!=='\n'))row++;}
  }else if(c===','){push();}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;end();start=++row;}
  else if(c==='"'){if(value||closed)throw Error('Invalid CSV quote at row '+start);quoted=true;}
  else {if(closed)throw Error('Unexpected text after quote at row '+start);value+=c;}
  if(value.length>32768)throw Error('CSV cell too large');
 }
 if(quoted)throw Error('Unclosed CSV quote');if(value||cells.length||closed)end();
 if(!rows.length)throw Error('CSV is empty');
 const headers=rows.shift()!.cells.map(s=>s.trim());
 if(headers.length<2||headers.some(s=>!s))throw Error('CSV requires non-empty column headers');
 return {headers,rows};
}
const normal=(v:string)=>v.trim().normalize('NFKC').toLocaleLowerCase('en').replace(/[\s_-]+/g,' ');
const aliases:Record<string,ImportColumn>={
 title:'title','manga title':'title',name:'title',status:'status','reading status':'status',
 type:'type','manga type':'type',author:'authors',authors:'authors',artist:'artists',artists:'artists',
 'alternative titles':'alternativeTitles',alternativetitles:'alternativeTitles',genres:'tags',tags:'tags',
 'total chapters':'totalChapters',totalchapters:'totalChapters','chapters read':'chaptersRead',chaptersread:'chaptersRead',
 rating:'rating','my rating':'rating',favourite:'favourite',favorite:'favourite','started on':'startedOn',startedon:'startedOn',
 'finished on':'finishedOn',finishedon:'finishedOn',notes:'notes','reading links':'readingLinks',readinglinks:'readingLinks'
};
export function suggestMapping(headers:string[]):Mapping{
 const matches=new Map<ImportColumn,number[]>();
 headers.forEach((h,i)=>{const label=normal(h);const key=Object.hasOwn(aliases,label)?aliases[label]:undefined;if(key)matches.set(key,[...(matches.get(key)??[]),i]);});
 return Object.fromEntries([...matches].filter(([,indices])=>indices.length===1).map(([key,indices])=>[key,indices[0]]));
}
const statusMap:Record<string,JournalFields['status']>={completed:'Completed',finished:'Completed',reading:'Reading','currently reading':'Reading',dropped:'Dropped','on hold':'On Hold','plan to read':'Plan to Read','to read':'Plan to Read'};
export function mapCsvRow(row:CsvRow,mapping:Mapping,headerCount:number):ImportPreviewRow{
 const read=(key:ImportColumn)=>{const index=mapping[key];return index===undefined?'':(row.cells[index]??'').trim();};
 const title=read('title');
 try{
  if(row.cells.length!==headerCount)throw Error('Column count differs from header');
  if(mapping.title===undefined||mapping.status===undefined)throw Error('Map both title and reading status');
  const values=Object.values(mapping).filter((v):v is number=>v!==undefined);
  if(new Set(values).size!==values.length||values.some(x=>!Number.isInteger(x)||x<0||x>=headerCount))throw Error('Invalid or repeated mapping');
  // Spreadsheet formulas are never evaluated; reject formula-like mapped text.
  for(const key of IMPORT_COLUMNS){const cell=read(key);if(/^[=+@]/.test(cell))throw Error('Formula-like value in '+key);}
  const integer=(key:ImportColumn)=>{const s=read(key);if(!s)return null;if(!/^\d+$/.test(s))throw Error('Invalid integer in '+key);return Number(s);};
  const list=(key:ImportColumn)=>{const s=read(key);if(!s)return [];
   // JSON arrays from our CSV export are supported, otherwise use newline or semicolon.
   if(s.startsWith('[')){const v:unknown=JSON.parse(s);if(!Array.isArray(v)||!v.every(x=>typeof x==='string'))throw Error('Invalid list in '+key);return v as string[];}
   return s.split(/[\n;]+/).map(x=>x.trim()).filter(Boolean);};
  const fav=normal(read('favourite'));if(fav&&!['yes','no','true','false','1','0'].includes(fav))throw Error('Invalid favourite flag');
  const fields=parseJournalFields({title,status:statusMap[normal(read('status'))],type:normal(read('type'))||null,
   authors:list('authors'),artists:list('artists'),alternativeTitles:list('alternativeTitles'),tags:list('tags'),
   totalChapters:integer('totalChapters'),chaptersRead:integer('chaptersRead'),rating:integer('rating'),favourite:['yes','true','1'].includes(fav),
   startedOn:read('startedOn')||null,finishedOn:read('finishedOn')||null,notes:read('notes')||null,readingLinks:list('readingLinks')});
  return {sourceRow:row.sourceRow,status:'addition',title:fields.title,fields};
 }catch(e){return {sourceRow:row.sourceRow,status:'invalid',title,reason:e instanceof Error?e.message:'Invalid row'};}
}
export interface TitleIndex {title:string;alternativeTitles:string[]}
export function previewCandidates(candidates:ImportCandidate[],existing:TitleIndex[]):ImportPreviewRow[]{
 const keys=(v:TitleIndex)=>new Set([v.title,...v.alternativeTitles].map(normal));
 const used=new Set(existing.flatMap(e=>[...keys(e)]));
 const counts=new Map<string,number>();
 for(const c of candidates)for(const k of keys(c.fields))counts.set(k,(counts.get(k)??0)+1);
 return candidates.map(c=>{
  const matches=[...keys(c.fields)];
  const reason=matches.some(k=>(counts.get(k)??0)>1)?'Duplicate or ambiguous title in batch':
   matches.some(k=>used.has(k))?'Possible existing or removed entry; review manually':undefined;
  return {sourceRow:c.sourceRow,status:reason?'conflict':'addition',title:c.fields.title,reason,fields:c.fields};
 });
}
export function parseImportCandidates(raw:unknown):ImportCandidate[]{
 if(!Array.isArray(raw)||!raw.length||raw.length>IMPORT_BATCH_LIMIT)throw Error('Invalid import batch');
 const seen=new Set<number>();
 return raw.map(value=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid import row');
  const o=value as Record<string,unknown>;
  if(Object.keys(o).sort().join(',')!=='fields,sourceRow'||typeof o.sourceRow!=='number'||!Number.isSafeInteger(o.sourceRow)||o.sourceRow<2||seen.has(o.sourceRow))throw Error('Invalid source row');
  seen.add(o.sourceRow);
  const fields=parseJournalFields(o.fields);
  if(fields.libraryMangaId!==null||fields.externalIds.length)throw Error('Link reconciliation is separate');
  return {sourceRow:o.sourceRow,fields};
 });
}
