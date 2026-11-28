// Local workerd D1 only: no Cloudflare API, credentials or real reading history.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
if(!process.env.JOURNAL_D1_TEST_PREFIX)throw Error('Set JOURNAL_D1_TEST_PREFIX to isolated Miniflare install');
const {Miniflare}=require(join(process.env.JOURNAL_D1_TEST_PREFIX,'node_modules/miniflare'));
const ORIGIN='https://taiyous-manga-library.pages.dev';
const bundle=await build({stdin:{contents:
  "import {onRequest as list} from './functions/api/journal/index';\n"+
  "import {onRequest as item} from './functions/api/journal/[id]';\n"+
  "import {onRequest as batch} from './functions/api/journal/import/[action]';\n"+
  "import {sessionCookie} from './functions/_lib/mangaAuth';\n"+
  "export default {async fetch(request,env){const path=new URL(request.url).pathname;"+
  "if(path==='/__test/session'){const owner=new URL(request.url).searchParams.get('owner')||'AdityaSreevatsaK';"+
  "return new Response(await sessionCookie({owner,access:'hf_synthetic',expires:Date.now()+600000,scope:'openid profile read-repos'},env));}"+
  "if(path==='/api/journal')return list({request,env});"+
  "if(path.startsWith('/api/journal/import/'))return batch({request,env,params:{action:path.split('/').at(-1)}});"+
  "if(path.startsWith('/api/journal/'))return item({request,env,params:{id:path.split('/').at(-1)}});return new Response(null,{status:404});}};",
 resolveDir:process.cwd(),sourcefile:'local-journal-test.ts',loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
const bindings={HF_REPO_ID:'AdityaSreevatsaK/Taiyous-Manga',HF_OWNER_USERNAME:'AdityaSreevatsaK',
 HF_CLIENT_ID:'synthetic-client',HF_CLIENT_SECRET:'synthetic-secret',SESSION_SECRET:Buffer.alloc(32,120).toString('base64')};
test('local workerd D1: owner CRUD, pagination, import snapshots, receipts, rollback',async()=>{
 const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2025-11-25',
  bindings,d1Databases:{JOURNAL_DB:'synthetic-journal-disposable'},d1Persist:false,cf:false});
 try{
  const db=await mf.getD1Database('JOURNAL_DB');
  for(const file of ['0001_journal.sql','0002_import_receipts.sql']){
   const sql=readFileSync(new URL('../migrations/journal/'+file,import.meta.url),'utf8').replace(/^--.*$/gm,'').trim();
   // Keep BEGIN...END trigger bodies intact, split only before top-level commands.
   const statements=sql.split(/;\s*(?=(?:CREATE|INSERT|$))/i).map(x=>x.trim()).filter(Boolean);
   for(const stmt of statements)await db.prepare(stmt).run();
  }
  const session=(await (await mf.dispatchFetch(ORIGIN+'/__test/session')).text()).split(';')[0];
  const wrong=(await (await mf.dispatchFetch(ORIGIN+'/__test/session?owner=Other')).text()).split(';')[0];
  const call=async(path='',method='GET',body=undefined,cookie=session,origin=ORIGIN)=>{
   const response=await mf.dispatchFetch(ORIGIN+'/api/journal'+path,{method,headers:{
    Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-Taiyou-Request':'journal'},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
   assert.match(response.headers.get('Cache-Control')??'',/no-store/);
   return {status:response.status,body:await response.json()};
  };
  assert.equal((await call('','GET',undefined,'')).status,401);
  assert.equal((await call('','GET',undefined,wrong)).status,401);
  assert.equal((await call('','POST',{title:'Synthetic',status:'Reading'},session,'https://foreign.example')).status,403);
  const a=await call('','POST',{title:'Synthetic alpha',status:'Plan to Read',favourite:true,lastReadChapter:'12.5'});
  assert.equal(a.status,201);assert.equal(a.body.rating,null);assert.equal(a.body.favourite,true);
  const id=a.body.id;
  const b=await call('/'+id,'PATCH',{revision:1,status:'Reading'});assert.equal(b.status,200);assert.equal(b.body.revision,2);
  assert.equal((await call('/'+id,'PATCH',{revision:1,rating:8})).status,409);
  assert.equal((await call('/'+id,'DELETE',{revision:2})).status,200);
  assert.equal((await call()).body.entries.length,0);assert.equal((await call('?deleted=true')).body.entries.length,1);
  assert.equal((await call('/'+id,'PATCH',{revision:3,restore:true})).status,200);
  const rows=[{sourceRow:2,fields:{title:'Synthetic beta',status:'Completed'}},{sourceRow:3,fields:{title:'Synthetic gamma',status:'Plan to Read'}}];
  const preview=await call('/import/preview','POST',{rows});assert.equal(preview.status,200);
  assert.deepEqual(preview.body.rows.map(x=>x.status),['addition','addition']);
  const changed=await call('','POST',{title:'Synthetic delta',status:'Reading'});assert.equal(changed.status,201);
  assert.equal((await call('/import/commit','POST',{version:preview.body.version,rows})).status,409);
  const fresh=await call('/import/preview','POST',{rows});assert.equal(fresh.status,200);
  const receipt=await call('/import/commit','POST',{version:fresh.body.version,rows});
  assert.equal(receipt.status,201);assert.equal(receipt.body.count,2);
  const replay=await call('/import/commit','POST',{version:fresh.body.version,rows});
  assert.equal(replay.status,200);assert.equal(replay.body.replayed,true);assert.equal(replay.body.batchId,receipt.body.batchId);
  assert.equal((await call('/import/preview','POST',{rows})).body.rows[0].status,'conflict');
  const total=await db.prepare('SELECT COUNT(*) AS n FROM journal_entries').first('n');assert.equal(total,4);
  // Exercise actual D1 batch rollback, including trigger-driven version changes.
  const v=await db.prepare('SELECT revision FROM journal_state WHERE singleton=1').first('revision');
  await assert.rejects(db.batch([
   db.prepare('INSERT INTO journal_import_receipts VALUES (?,1,?,1)').bind('synthetic-rollback','2026-01-01T00:00:00.000Z'),
   db.prepare('UPDATE journal_entries SET revision=revision+1 WHERE id=?').bind(id),
   db.prepare('INSERT INTO journal_import_receipts VALUES (?,1,?,0)').bind('synthetic-invalid','2026-01-01T00:00:00.000Z')
  ]));
  assert.equal(await db.prepare('SELECT revision FROM journal_state WHERE singleton=1').first('revision'),v);
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM journal_import_receipts WHERE batch_id=?').bind('synthetic-rollback').first('n'),0);
  // Force a second page with only synthetic records.
  for(let start=0;start<100;start+=50){
   const pageRows=Array.from({length:50},(_,i)=>({sourceRow:i+2,fields:{title:'Synthetic page '+(start+i),status:'Plan to Read'}}));
   const p=await call('/import/preview','POST',{rows:pageRows});assert.equal(p.status,200);
   assert.equal((await call('/import/commit','POST',{version:p.body.version,rows:pageRows})).status,201);
  }
  const first=await call();assert.equal(first.status,200);assert.equal(first.body.entries.length,100);assert.ok(first.body.nextCursor);
  const second=await call('?after='+first.body.nextCursor);assert.equal(second.body.entries.length,4);assert.equal(second.body.nextCursor,null);
  assert.equal(new Set([...first.body.entries,...second.body.entries].map(x=>x.id)).size,104);
 }finally{await mf.dispose();}
});
