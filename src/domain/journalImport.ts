import {parseJournalFields,type JournalFields,type JournalRecord} from './journal';
export const IMPORT_BATCH_LIMIT=50;
export const IMPORT_COLUMNS=['title','status','type','publicationStatus','lastReadChapter','authors','artists','alternativeTitles','tags','totalChapters','chaptersRead','rating','favourite','startedOn','finishedOn','notes','readingLinks'] as const;
export type ImportColumn=typeof IMPORT_COLUMNS[number];
export type Mapping=Partial<Record<ImportColumn,number>>;
export interface CsvRow {sourceRow:number;cells:string[];yellowColumns?:number[]}
export interface ImportPolicy {blankMeansPlanToRead?:boolean;yellowMeansFavourite?:boolean}
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
export const normaliseImportTitle=(v:string)=>v.trim().normalize('NFKC').toLocaleLowerCase('en').replace(/[\s_-]+/g,' ');
const aliases:Record<string,ImportColumn>={
 title:'title','manga title':'title',name:'title',status:'status','reading status':'status','publication status':'publicationStatus',publicationstatus:'publicationStatus','last read':'lastReadChapter','last read chapter':'lastReadChapter',lastreadchapter:'lastReadChapter',
 type:'type','manga type':'type',author:'authors',authors:'authors',artist:'artists',artists:'artists',
 'alternative titles':'alternativeTitles',alternativetitles:'alternativeTitles',genres:'tags',tags:'tags',
 'total chapters':'totalChapters',totalchapters:'totalChapters','chapters read':'chaptersRead',chaptersread:'chaptersRead',
 rating:'rating','my rating':'rating',favourite:'favourite',favorite:'favourite','started on':'startedOn',startedon:'startedOn',
 'finished on':'finishedOn',finishedon:'finishedOn',notes:'notes',opinion:'notes','reading links':'readingLinks',readinglinks:'readingLinks'
};
export function legacyReadingList(headers:string[]):boolean{
 const keys=new Set(headers.map(normaliseImportTitle));
 return ['name','status','reading status','last read','opinion'].every(h=>keys.has(h));
}
export function suggestMapping(headers:string[]):Mapping{
 const matches=new Map<ImportColumn,number[]>();
 const hasReading=headers.some(h=>normaliseImportTitle(h)==='reading status');
 headers.forEach((h,i)=>{const label=normaliseImportTitle(h);const key=label==='status'&&hasReading?'publicationStatus':Object.hasOwn(aliases,label)?aliases[label]:undefined;if(key)matches.set(key,[...(matches.get(key)??[]),i]);});
 return Object.fromEntries([...matches].filter(([,indices])=>indices.length===1).map(([key,indices])=>[key,indices[0]]));
}
const statusMap:Record<string,JournalFields['status']>={completed:'Completed',complete:'Completed',finished:'Completed',started:'Reading',reading:'Reading','currently reading':'Reading',dropped:'Dropped','on hold':'On Hold','plan to read':'Plan to Read','to read':'Plan to Read'};
export function mapCsvRow(row:CsvRow,mapping:Mapping,headerCount:number,policy:ImportPolicy={}):ImportPreviewRow{
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
  const fav=normaliseImportTitle(read('favourite'));if(fav&&!['yes','no','true','false','1','0'].includes(fav))throw Error('Invalid favourite flag');
  const rawStatus=normaliseImportTitle(read('status'));
  const status=policy.blankMeansPlanToRead&&!rawStatus?'Plan to Read':Object.hasOwn(statusMap,rawStatus)?statusMap[rawStatus]:undefined;
  if(!status)throw Error('Personal reading status needs review (blank or ambiguous)');
  const publication=normaliseImportTitle(read('publicationStatus'));
  const publicationStatus=publication==='complete'?'completed':publication===''||publication==='?'||publication==='-'?null:publication;
  const label=read('lastReadChapter');
  const lastReadChapter=label==='-'||label==='?'||!label?null:label;
  const fields=parseJournalFields({title,status,type:normaliseImportTitle(read('type'))||null,publicationStatus,lastReadChapter,
   authors:list('authors'),artists:list('artists'),alternativeTitles:list('alternativeTitles'),tags:list('tags'),
   totalChapters:integer('totalChapters'),chaptersRead:integer('chaptersRead'),rating:integer('rating'),favourite:fav?['yes','true','1'].includes(fav):!!(policy.yellowMeansFavourite&&row.yellowColumns?.includes(mapping.title)),
   startedOn:read('startedOn')||null,finishedOn:read('finishedOn')||null,notes:read('notes')||null,readingLinks:list('readingLinks')});
  return {sourceRow:row.sourceRow,status:'addition',title:fields.title,fields};
 }catch(e){return {sourceRow:row.sourceRow,status:'invalid',title,reason:e instanceof Error?e.message:'Invalid row'};}
}
export interface TitleIndex {title:string;alternativeTitles:string[]}
export function previewCandidates(candidates:ImportCandidate[],existing:TitleIndex[]):ImportPreviewRow[]{
 const keys=(v:TitleIndex)=>new Set([v.title,...v.alternativeTitles].map(normaliseImportTitle));
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
