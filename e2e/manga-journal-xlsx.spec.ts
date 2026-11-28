import {test,expect} from '@playwright/test';
import {deflateRawSync} from 'node:zlib';
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function crc32(bytes:Buffer){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zip(parts:Record<string,string>){
 const locals:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const [name,text] of Object.entries(parts)){
  const n=Buffer.from(name),raw=Buffer.from(text),compressed=deflateRawSync(raw),crc=crc32(raw);
  const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(8,8);l.writeUInt32LE(crc,14);
  l.writeUInt32LE(compressed.length,18);l.writeUInt32LE(raw.length,22);l.writeUInt16LE(n.length,26);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);
  c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  locals.push(l,n,compressed);central.push(c,n);offset+=l.length+n.length+compressed.length;
 }
 const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(parts).length,8);
 end.writeUInt16LE(Object.keys(parts).length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,dir,end]);
}
const inline=(ref:string,text:string)=>'<c r="'+ref+'" t="inlineStr"><is><t>'+text+'</t></is></c>';
const headers=['Sl. No','Name','Status','Reading status','Last Read','Opinion'];
const sheet=(title:string,status:string)=>'<worksheet xmlns="'+ns+'"><sheetData>'+
 '<row r="1">'+inline('A1','Reading list')+'</row><row r="2">'+headers.map((h,i)=>inline(String.fromCharCode(65+i)+'2',h)).join('')+'</row>'+
 '<row r="4"><c r="A4"><v>1</v></c>'+inline('B4',title).replace('r="B4"','r="B4" s="1"')+inline('C4','Completed')+inline('D4',status)+'<c r="E4"><v>12.5</v></c></row>'+
 '<row r="5"><c r="A5"><v>2</v></c></row></sheetData></worksheet>';
test('private XLSX reader detects real headers, worksheet and duplicate review',async({page})=>{
 await page.route('**/api/library',route=>route.fulfill({status:503,json:{error:'Synthetic outage'}}));
 await page.route('**/api/journal?*',route=>route.fulfill({json:{schemaVersion:1,entries:[],nextCursor:null}}));
 await page.route('**/api/journal/import/preview',async route=>{
  const body=route.request().postDataJSON();
  expect(body.rows[0].fields).toMatchObject({status:'Reading',publicationStatus:'completed',lastReadChapter:'12.5',chaptersRead:null,rating:null,favourite:true});
  await route.fulfill({json:{version:1,rows:body.rows.map((r:{sourceRow:number;fields:{title:string}})=>({...r,title:r.fields.title,status:'addition'}))}});
 });
 const workbook=zip({
  'xl/workbook.xml':'<workbook xmlns="'+ns+'" xmlns:r="'+rel+'"><sheets><sheet name="First" sheetId="1" r:id="rId1"/><sheet name="Second" sheetId="2" r:id="rId2"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+rel+'/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="'+rel+'/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
  'xl/styles.xml':'<styleSheet xmlns="'+ns+'"><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill></fills><cellXfs count="2"><xf fillId="0"/><xf fillId="1"/></cellXfs></styleSheet>',
  'xl/worksheets/sheet1.xml':sheet('Synthetic duplicate','Started'),
  'xl/worksheets/sheet2.xml':sheet('Synthetic duplicate','')
 });
 await page.goto('/journal');
 await page.getByRole('button',{name:'Import spreadsheet'}).click();
 await page.getByLabel('Choose XLSX or CSV').setInputFiles({name:'synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook});
 await expect(page.getByLabel('Worksheet')).toBeVisible();
 await expect(page.getByText('Row 4: Synthetic duplicate', {exact:false})).toContainText('Duplicate title in workbook');
 await page.getByRole('button',{name:'Retain reviewed row 4'}).click();
 await page.getByRole('button',{name:'Review against Journal'}).click();
 await expect(page.getByRole('button',{name:'Confirm import of 1 new entries'})).toBeVisible();
 await page.getByLabel('Worksheet').selectOption('1');
 await expect(page.getByText('Row 4: Synthetic duplicate', {exact:false})).toContainText('Plan to Read');
 await page.getByLabel('Blank reading status means Plan to Read').uncheck();
 await expect(page.getByLabel('Resolve personal status for row 4')).toBeVisible();
 await page.getByLabel('Resolve personal status for row 4').selectOption('Reading');
 await expect(page.getByRole('button',{name:'Retain reviewed row 4'})).toBeVisible();
});
