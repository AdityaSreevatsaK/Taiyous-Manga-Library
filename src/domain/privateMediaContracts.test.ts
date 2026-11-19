import { describe,expect,it,vi } from 'vitest';
import { demoEntries,demoManifests } from '../data/fixtures';
import { UnconnectedPrivateMedia,verifyPageIdentity,verifyPrivateCatalogue,
  verifyPrivateManifest,verifyPrivateRights } from './privateMediaContracts';

describe('safe, server-gated private media port',()=>{
  it('denies all operations by default without fetching or claiming a cloud session',async()=>{
    const gateway=new UnconnectedPrivateMedia();
    const spy=vi.spyOn(globalThis,'fetch');
    try{
      expect(await gateway.getCatalogue()).toEqual({status:'not-connected'});
      expect(await gateway.getChapterManifest('mng_valid0000','ch_valid0000')).toEqual({status:'not-connected'});
      expect(await gateway.getRights('mng_valid0000')).toEqual({status:'not-connected'});
      expect(await gateway.getPage({mangaId:'mng_valid0000',chapterId:'ch_valid0000',pageId:'pg_valid0000'}))
        .toEqual({status:'not-connected'});
      expect(spy).not.toHaveBeenCalled();
    }finally{spy.mockRestore();}
  });
  it('resolves only a page belonging to its immutable manga and chapter identities',()=>{
    const m=demoEntries[0]!;
    const ch=m.chapters[0]!.id;
    const page=demoManifests.get(ch)!.pages[0]!;
    expect(verifyPageIdentity({mangaId:m.id,chapterId:ch,pageId:page.id},demoEntries,demoManifests))
      .toEqual(page);
    expect(()=>verifyPageIdentity({mangaId:m.id,chapterId:demoEntries[1]!.chapters[0]!.id,
      pageId:page.id},demoEntries,demoManifests)).toThrow('chapter does not belong');
    expect(()=>verifyPageIdentity({mangaId:m.id,chapterId:ch,pageId:'pg_nonexisting00'},
      demoEntries,demoManifests)).toThrow('page not found');
    expect(()=>verifyPageIdentity({mangaId:'https://other.host/x',chapterId:ch,pageId:page.id},
      demoEntries,demoManifests)).toThrow('series not found');
  });
  it('rejects a forged remote asset and a wrong or untrusted chapter manifest',()=>{
    const m=demoEntries[0]!;
    const id=m.chapters[0]!.id;
    const valid=demoManifests.get(id)!;
    expect(verifyPrivateManifest(valid,m.id,id,demoEntries)).toEqual(valid);
    expect(()=>verifyPrivateManifest({...valid,chapterId:'ch_forged00000'},m.id,id,demoEntries))
      .toThrow('does not match');
    expect(()=>verifyPrivateManifest({...valid,pages:[{...valid.pages[0]!,assetPath:'https://evil.example/i.png'}]},
      m.id,id,demoEntries)).toThrow('invalid private relative asset path');
    expect(()=>verifyPrivateManifest(valid,demoEntries[1]!.id,id,demoEntries)).toThrow('not in catalogue');
  });
  it('validates catalogue and rights evidence rather than trusting the provider response',()=>{
    expect(verifyPrivateCatalogue(demoEntries)).toEqual(demoEntries);
    expect(()=>verifyPrivateCatalogue([{kind:'manga',id:'https://wrong.com'}]))
      .toThrow();
    const valid={schemaVersion:1,sourceType:'original',title:'Fictional trial',
      permissionEvidence:'Original generated artwork, independently owned',attribution:'Taiyou Studio',
      recordedAt:'2026-11-19T00:00:00.000Z'};
    expect(verifyPrivateRights(valid)).toEqual(valid);
    expect(()=>verifyPrivateRights({...valid,sourceType:'unknown'})).toThrow();
    expect(()=>verifyPrivateRights({...valid,permissionEvidence:''})).toThrow();
  });
});
