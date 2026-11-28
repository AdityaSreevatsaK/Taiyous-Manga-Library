import {suggestMapping,type CsvRow} from '../domain/journalImport';
/** Bounded read-only OOXML reader for ordinary text/number workbooks. No external
 * links, macros, formula evaluation, remote requests or executable content. */
export interface SheetData {name:string;headers:string[];rows:CsvRow[]}
const MAX_FILE=2*1024*1024,MAX_XML=8*1024*1024,MAX_TOTAL=24*1024*1024;
const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const decoder=new TextDecoder('utf-8',{fatal:true});
const fail=():never=>{throw Error('Unsupported or invalid XLSX workbook');};
type Member={name:string;method:number;compressed:number;size:number;offset:number;crc:number};
function members(buffer:ArrayBuffer){
 const v=new DataView(buffer),bytes=new Uint8Array(buffer);
 if(bytes.length>MAX_FILE||bytes.length<22)fail();
 const u16=(p:number)=>v.getUint16(p,true),u32=(p:number)=>v.getUint32(p,true);
 let end=bytes.length-22;
 while(end>=Math.max(0,bytes.length-65557)){
  if(u32(end)===0x06054b50&&end+22+u16(end+20)===bytes.length)break;
  end--;
 }
 if(end<0||end<bytes.length-65557||u32(end)!==0x06054b50||u16(end+4)||u16(end+6)||u16(end+8)!==u16(end+10))fail();
 const count=u16(end+10),central=u32(end+16),length=u32(end+12);
 if(!count||count>256||central+length!==end)fail();
 let p=central,total=0;const index=new Map<string,Member>();
 for(let i=0;i<count;i++){
  if(p+46>end||u32(p)!==0x02014b50)fail();
  const flags=u16(p+8),method=u16(p+10),crc=u32(p+16),compressed=u32(p+20),size=u32(p+24),n=u16(p+28),extra=u16(p+30),comment=u16(p+32),offset=u32(p+42);
  if((flags&1)||u16(p+34)||![0,8].includes(method)||p+46+n+extra+comment>end||size>MAX_XML||compressed>MAX_FILE||offset+30>central)fail();
  const name=decoder.decode(bytes.subarray(p+46,p+46+n));
  if(!name||name.startsWith('/')||name.includes('\\')||name.split('/').some(x=>x==='..')||index.has(name))fail();
  total+=size;if(total>MAX_TOTAL)fail();
  index.set(name,{name,method,compressed,size,offset,crc});p+=46+n+extra+comment;
 }
 if(p!==end)fail();
 return {v,bytes,index,central};
}
function crc32(bytes:Uint8Array){
 let crc=0xffffffff;
 for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
async function part(zip:ReturnType<typeof members>,name:string):Promise<string>{
 const m=zip.index.get(name);if(!m)throw Error('Missing workbook part');
 const {v,bytes,central}=zip,p=m.offset;
 if(v.getUint32(p,true)!==0x04034b50||v.getUint16(p+8,true)!==m.method||v.getUint16(p+6,true)&1)fail();
 const n=v.getUint16(p+26,true),extra=v.getUint16(p+28,true),start=p+30+n+extra;
 if(start+m.compressed>central||decoder.decode(bytes.subarray(p+30,p+30+n))!==name)fail();
 const input=bytes.slice(start,start+m.compressed);
 let data:Uint8Array;
 if(m.method===0)data=input;
 else{
  const stream=new Blob([input]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader=stream.getReader();const output=new Uint8Array(m.size);let count=0;
  try{while(true){const chunk=await reader.read();if(chunk.done)break;
   if(count+chunk.value.length>m.size)fail();output.set(chunk.value,count);count+=chunk.value.length;
  }}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
  if(count!==m.size)fail();data=output;
 }
 if(data.length!==m.size||crc32(data)!==m.crc)fail();
 const text=decoder.decode(data);
 if(/<!DOCTYPE|<!ENTITY/i.test(text))fail();
 return text;
}
function xml(text:string){
 const d=new DOMParser().parseFromString(text,'application/xml');
 if(d.getElementsByTagName('parsererror').length)fail();
 return d;
}
const children=(el:Element|Document,tag:string)=>Array.from(el.getElementsByTagNameNS(MAIN,tag));
function textValue(el:Element){return children(el,'t').map(x=>x.textContent??'').join('');}
function colIndex(ref:string){
 const m=/^([A-Z]{1,3})([1-9][0-9]*)$/.exec(ref);if(!m)fail();
 let n=0;for(const c of m![1]!)n=n*26+c.charCodeAt(0)-64;return n-1;
}
function parseSheet(doc:Document,strings:string[],name:string):SheetData|null{
 const sheet=children(doc,'sheetData')[0];if(!sheet)fail();
 const raw:CsvRow[]=[];let previous=0;
 for(const row of children(sheet!,'row')){
  const sourceRow=Number(row.getAttribute('r'));if(!Number.isSafeInteger(sourceRow)||sourceRow<=previous||sourceRow>100000)fail();previous=sourceRow;
  const cells:string[]=[];const used=new Set<number>();
  for(const cell of children(row,'c')){
   const ref=cell.getAttribute('r')??'',col=colIndex(ref);
   if(Number(ref.match(/\d+$/)?.[0])!==sourceRow||used.has(col))fail();used.add(col);
   if(col>=100){if(children(cell,'v').length||children(cell,'f').length||children(cell,'is').length)fail();continue;}
   const t=cell.getAttribute('t'),v=children(cell,'v')[0]?.textContent??'';
   let value='';
   if(children(cell,'f').length)value='=FORMULA_NOT_IMPORTED';
   else if(t==='s'){if(!/^\d+$/.test(v)||!Object.hasOwn(strings,Number(v)))fail();value=strings[Number(v)]!;}
   else if(t==='inlineStr')value=textValue(cell);
   else if(t==='b')value=v==='1'?'true':v==='0'?'false':'=INVALID_BOOLEAN';
   else if(t==='e')value='=EXCEL_ERROR';
   else if(t===null||['n','str','d'].includes(t))value=v;
   else fail();
   if(value.length>32768)fail();cells[col]=value;
  }
  if(cells.some(x=>x?.trim()))raw.push({sourceRow,cells:Array.from(cells,x=>x??'')});
  if(raw.length>5005)fail();
 }
 // Locate the actual header, allowing a merged title/banner above it.
 const headerAt=raw.slice(0,10).findIndex(row=>{const m=suggestMapping(row.cells);return m.title!==undefined&&m.status!==undefined;});
 if(headerAt<0)return null;
 const headers=raw[headerAt]!.cells.map(x=>x.trim()),mapping=suggestMapping(headers);
 if(headers.some(x=>!x))throw Error('Blank worksheet header');
 const rows=raw.slice(headerAt+1).filter(row=>!!row.cells[mapping.title!]?.trim()||
   row.cells.some((v,i)=>i!==0&&v.trim())).map(row=>{
  if(row.cells.slice(headers.length).some(x=>x.trim()))throw Error('Unexpected worksheet columns');
  return {sourceRow:row.sourceRow,cells:Array.from({length:headers.length},(_,i)=>row.cells[i]??'')};
 });
 return {name,headers,rows};
}
export async function readJournalXlsx(buffer:ArrayBuffer):Promise<SheetData[]>{
 const zip=members(buffer);
 const book=xml(await part(zip,'xl/workbook.xml'));
 const relationships=xml(await part(zip,'xl/_rels/workbook.xml.rels'));
 const paths=new Map<string,string>();
 for(const el of Array.from(relationships.getElementsByTagNameNS('*','Relationship'))){
  if(!el.getAttribute('Type')?.endsWith('/worksheet')||el.getAttribute('TargetMode')==='External')continue;
  const id=el.getAttribute('Id')??'',target=el.getAttribute('Target')??'';
  const path=target.startsWith('/')?target.slice(1):'xl/'+target;
  if(!id||!/^xl\/worksheets\/[A-Za-z0-9_-]+\.xml$/.test(path)||paths.has(id))fail();paths.set(id,path);
 }
 const strings=zip.index.has('xl/sharedStrings.xml')?children(xml(await part(zip,'xl/sharedStrings.xml')),'si').map(textValue):[];
 if(strings.length>50000||strings.some(s=>s.length>32768))fail();
 const result:SheetData[]=[];const sheets=children(book,'sheet');
 if(sheets.length>20)fail();
 for(const sheet of sheets){
  if(sheet.getAttribute('state')==='hidden'||sheet.getAttribute('state')==='veryHidden')continue;
  const id=sheet.getAttributeNS(REL,'id')??'',path=paths.get(id),name=sheet.getAttribute('name')??'';
  if(!path||!name||name.length>31)fail();
  const parsed=parseSheet(xml(await part(zip,path!)),strings,name);
  if(parsed)result.push(parsed);
 }
 if(!result.length)throw Error('No worksheet has recognisable title and reading-status headers');
 return result;
}
