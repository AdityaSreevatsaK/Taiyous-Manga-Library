import {afterEach,describe,it,expect,vi} from 'vitest';
import {demoEntries} from '../../src/data/fixtures';
import {applyMetadataCorrection,metadataCorrectionCommit,onRequest,parseMetadataCorrection} from './master';
import {ORIGIN,REPO,sessionCookie} from '../_lib/mangaAuth';
const revision='a'.repeat(40);
const source={schemaVersion:1,mediaKind:'manga',entries:demoEntries};
describe('protected catalogue metadata correction',()=>{
  it('rejects malformed revisions, unrelated IDs and extra fields',()=>{
    expect(parseMetadataCorrection({mangaId:demoEntries[0]!.id,revision:'abc',title:'New'})).toBeNull();
    expect(parseMetadataCorrection({mangaId:demoEntries[0]!.id,revision,title:'New',delete:true})).toBeNull();
    expect(parseMetadataCorrection({mangaId:demoEntries[0]!.id,revision})).toBeNull();
    expect(parseMetadataCorrection({mangaId:demoEntries[0]!.id,revision,creators:['Same','same']})).toBeNull();
  });
  it('preserves immutable manga/chapter identities and untouched records',()=>{
    const manga=demoEntries[0]!;
    const patch=parseMetadataCorrection({mangaId:manga.id,revision,title:'Updated Manga Title',
      creators:['Verified Writer'],publicationStatus:'completed'});
    expect(patch).not.toBeNull();
    const corrected=applyMetadataCorrection(source,patch!) as typeof source;
    const modified=corrected.entries[0]!;
    expect(modified.title).toBe('Updated Manga Title');
    expect(modified.creators).toEqual(['Verified Writer']);
    expect(modified.publicationStatus).toBe('completed');
    expect(modified.id).toBe(manga.id);
    expect(modified.slug).toBe(manga.slug??manga.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));
    expect(modified.chapters).toEqual(manga.chapters);
    expect(corrected.entries.slice(1)).toEqual(source.entries.slice(1));
    expect(source.entries[0]!.title).not.toBe('Updated Manga Title');
  });
  it('rejects unavailable entry rather than rewriting the full catalogue',()=>{
    expect(()=>applyMetadataCorrection(source,{mangaId:'mng_notpresentxyz',revision,title:'Unknown'})).toThrow();
  });
  it('stores the exact original catalogue before a revision-guarded metadata correction',()=>{
    const original=JSON.stringify(source,null,2)+'\n';
    const patch=parseMetadataCorrection({mangaId:demoEntries[0]!.id,revision,
      title:'Corrected synthetic title'})!;
    const updated=applyMetadataCorrection(source,patch);
    const result=metadataCorrectionCommit(original,updated,revision);
    expect(result.backupPath).toBe('control/master-catalogue-backups/'+revision+'/library.json');
    expect(result.operations).toHaveLength(3);
    expect(result.operations[0]!.value).toMatchObject({parentCommit:revision});
    expect(result.operations[1]!.value).toEqual({
      path:result.backupPath,content:original,encoding:'utf-8',
    });
    expect(result.operations[2]!.value).toMatchObject({path:'data/library.json'});
    expect(()=>metadataCorrectionCommit(original,updated,'bad')).toThrow('revision');
    expect(source.entries[0]!.title).not.toBe('Corrected synthetic title');
  });
  it('backs up original bytes in the same protected remote commit and checks read-back',async()=>{
    const token='hf_'+'t'.repeat(48),nextRevision='b'.repeat(40);
    const original=JSON.stringify(source)+'\n';
    const secret='synthetic-only-owner-passphrase-12345';
    const env={HF_REPO_ID:REPO,HF_OWNER_USERNAME:'AdityaSreevatsaK',
      HF_CLIENT_ID:'synthetic-client-id',HF_CLIENT_SECRET:'synthetic-client-secret',
      SESSION_SECRET:btoa('a'.repeat(32)),TAIYOU_OWNER_PASSPHRASE:secret};
    const session=(await sessionCookie({access:token,owner:'AdityaSreevatsaK',
      expires:Date.now()+3600000,scope:'read-repos write-repos'},env)).split(';')[0]!;
    const headers={Cookie:session,Origin:ORIGIN,'X-Taiyou-Request':'master-controls',
      'Content-Type':'application/json'};
    const unlock=await onRequest({request:new Request(ORIGIN+'/api/master?action=unlock',{
      method:'POST',headers,body:JSON.stringify({passphrase:secret}),
    }),env});
    expect(unlock.status).toBe(200);
    const grant=unlock.headers.get('Set-Cookie')?.split(';')[0];
    expect(grant).toMatch(/^__Host-taiyou_manga_master=/);
    let metadataChecks=0,commitCalls=0;
    const expectedBackup='control/master-catalogue-backups/'+revision+'/library.json';
    const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
      const url=String(input);
      if(url.endsWith('/api/datasets/'+REPO)){
        metadataChecks++;
        return Response.json({private:true,sha:metadataChecks===1?revision:nextRevision});
      }
      if(url.includes('/resolve/'+revision+'/data/library.json'))
        return new Response(original,{status:200,
          headers:{'Content-Length':String(new TextEncoder().encode(original).length)}});
      if(url.includes('/resolve/'+revision+'/'+expectedBackup))
        return new Response(null,{status:404});
      if(url.endsWith('/api/datasets/'+REPO+'/commit/main')){
        commitCalls++;
        expect(init?.method).toBe('POST');
        const rows=String(init?.body).trim().split('\n').map(row=>JSON.parse(row) as {
          key:string;value:Record<string,unknown>,
        });
        expect(rows.map(row=>row.key)).toEqual(['header','file','file']);
        expect(rows[0]!.value.parentCommit).toBe(revision);
        expect(rows[1]!.value).toEqual({path:expectedBackup,content:original,encoding:'utf-8'});
        expect(rows[2]!.value.path).toBe('data/library.json');
        const amended=JSON.parse(String(rows[2]!.value.content));
        expect(amended.entries[0].title).toBe('Corrected synthetic title');
        expect(amended.entries.slice(1)).toEqual(source.entries.slice(1));
        return Response.json({commitOid:nextRevision});
      }
      if(url.includes('/resolve/'+nextRevision+'/'+expectedBackup))
        return new Response(original,{status:200});
      throw Error('Unexpected synthetic network call '+url);
    });
    try{
      const response=await onRequest({request:new Request(
        ORIGIN+'/api/master?action=update-metadata',{
          method:'POST',headers:{...headers,Cookie:session+'; '+grant},
          body:JSON.stringify({mangaId:demoEntries[0]!.id,revision,
            title:'Corrected synthetic title'}),
        }),env});
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        saved:true,revision:nextRevision,backupPath:expectedBackup,
      });
      expect(commitCalls).toBe(1);
      expect(metadataChecks).toBe(2);
      expect(fetcher).toHaveBeenCalled();
    }finally{vi.restoreAllMocks();}
  });
});
