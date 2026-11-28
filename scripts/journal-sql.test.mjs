import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const sql = name=>readFileSync(new URL('../migrations/journal/'+name,import.meta.url),'utf8');
function database(){
 const db=new DatabaseSync(':memory:');
 for(const file of ['0001_journal.sql','0002_import_receipts.sql']){db.exec(sql(file));db.exec(sql(file));}
 return db;
}
const id=n=>'jrn_'+String(n).padStart(32,'0');
const time='2026-01-01T00:00:00.000Z';
const insert=(db,n,link=null)=>db.prepare('INSERT INTO journal_entries (id,revision,created_at,updated_at,deleted_at,library_manga_id,payload) VALUES (?,1,?,?,NULL,?,?)').run(id(n),time,time,link,JSON.stringify({title:'Synthetic '+n,alternativeTitles:[]}));
const version=db=>db.prepare('SELECT revision FROM journal_state').get().revision;
const count=db=>db.prepare('SELECT COUNT(*) AS n FROM journal_entries').get().n;
const receipt=(db,key,v)=>db.prepare('INSERT INTO journal_import_receipts(batch_id,entry_count,committed_at,snapshot_valid) VALUES (?,1,?,(SELECT revision = ? FROM journal_state WHERE singleton=1))').run(key,time,v);
test('revision guards, recoverable deletion and unique active archive link',()=>{
 const db=database();
 try{
  insert(db,1,'mng_synthetic1');assert.equal(version(db),1);
  assert.throws(()=>insert(db,2,'mng_synthetic1'));
  const update=db.prepare('UPDATE journal_entries SET revision=revision+1,deleted_at=? WHERE id=? AND revision=?');
  assert.equal(update.run(time,id(1),1).changes,1);
  assert.equal(update.run(time,id(1),1).changes,0);assert.equal(version(db),2);
  insert(db,2,'mng_synthetic1');assert.throws(()=>update.run(null,id(1),2));assert.equal(count(db),2);
 }finally{db.close();}
});
test('receipt and rows commit or roll back together, stale snapshots fail and receipts cannot replay',()=>{
 const db=database();
 try{
  db.exec('BEGIN');receipt(db,'batch-a',0);insert(db,1);db.exec('COMMIT');
  assert.equal(version(db),1);assert.equal(count(db),1);
  assert.throws(()=>receipt(db,'batch-a',1));
  assert.throws(()=>receipt(db,'batch-b',0));
  db.exec('BEGIN');receipt(db,'batch-c',1);insert(db,2);
  assert.throws(()=>insert(db,2));db.exec('ROLLBACK');
  assert.equal(count(db),1);assert.equal(version(db),1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM journal_import_receipts WHERE batch_id='batch-c'").get().n,0);
 }finally{db.close();}
});
