import {afterEach,describe,expect,it,vi} from 'vitest';
import {onRequest,clearPrivateMediaMetadataCacheForTests} from '../../functions/api/media/[kind]';
import {REPO,ORIGIN,sessionCookie,type Env} from '../../functions/_lib/mangaAuth';
import {demoEntries} from '../data/fixtures';

const sha='b'.repeat(40),token='hf_'+'c'.repeat(48);
const id=demoEntries[0]!.id,chapterId=demoEntries[0]!.chapters[0]!.id,pageId='pg_'+'a'.repeat(24);
const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/IX8AAAAASUVORK5CYII='),x=>x.charCodeAt(0));
const env:Env={HF_REPO_ID:REPO,HF_OWNER_USERNAME:'AdityaSreevatsaK',
  HF_CLIENT_ID:'test-client-id',HF_CLIENT_SECRET:'test-client-secret',
  SESSION_SECRET:btoa('a'.repeat(32))};
const file='manga/'+id+'/'+chapterId+'/'+pageId+'.png';
const entry={...demoEntries[0],chapters:[{...demoEntries[0]!.chapters[0],pageCount:1}]};
const digest=async()=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',png.buffer))]
 .map(b=>b.toString(16).padStart(2,'0')).join('');
const cookie=async()=> (await sessionCookie({access:token,owner:'AdityaSreevatsaK',expires:Date.now()+120000},env)).split(';')[0]!;
async function setup(overrides?:{hash?:string,missing?:boolean,private?:boolean}){
 clearPrivateMediaMetadataCacheForTests();
 const manifest={schemaVersion:1,mediaKind:'manga',chapterId,pages:[{
   id:pageId,assetPath:file,mimeType:'image/png',width:1,height:1,byteSize:png.byteLength,
   sha256:overrides?.hash??await digest(),
 }]};
 const spy=vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
   const url=String(input);
   if(url.endsWith('/api/datasets/'+REPO))
     return Response.json({sha,private:overrides?.private??true});
   if(url.includes('/data/library.json'))return new Response('',{status:404});
   if(url.includes('/tree/'+sha+'/data'))return new Response('',{status:404});
   if(url.includes('/catalogue.json'))return Response.json([entry]);
   if(url.includes('/manifests/'+chapterId+'.json'))return Response.json(manifest);
   if(url.includes('/assets/'+file))return overrides?.missing?
     new Response('',{status:404}) :
     new Response(png.slice().buffer,{status:200,headers:{'Content-Type':'image/png'}});
   throw Error('Unexpected private provider request '+url);
 });
 return spy;
}
const request=async(kind:string,query:string,auth=true,method='GET')=>{
 const headers:Record<string,string>=auth?{Cookie:await cookie()}:{};
 return onRequest({request:new Request(ORIGIN+'/api/media/'+kind+'?'+query,{method,headers}),env});
};
const params=new URLSearchParams({mangaId:id,chapterId});
const pageParams=new URLSearchParams({mangaId:id,chapterId,pageId,revision:sha});
afterEach(()=>{clearPrivateMediaMetadataCacheForTests();vi.restoreAllMocks();});

describe('owner-only verified private manga image gateway',()=>{
 it('denies unauthenticated, wrong-method and malformed requests before any provider reads',async()=>{
   const spy=vi.spyOn(globalThis,'fetch');
   expect((await request('manifest',String(params),false)).status).toBe(401);
   expect((await request('page',String(pageParams),false)).status).toBe(401);
   expect((await request('page',String(pageParams),true,'POST')).status).toBe(405);
   expect((await request('page','mangaId=../evil&chapterId='+chapterId+'&pageId='+pageId+'&revision='+sha)).status).toBe(400);
   expect(spy).not.toHaveBeenCalled();
 });
 it('accepts the existing legacy ReLIFE-compatible manifest without copying the dataset',async()=>{
   const spy=await setup();
   const response=await request('manifest',String(params));
   expect(response.status).toBe(200);
   expect(await response.json()).toMatchObject({revision:sha,manifest:{
     schemaVersion:1,mediaKind:'manga',chapterId,pages:[{id:pageId,assetPath:file}],
   }});
   expect(response.headers.get('Cache-Control')).toContain('no-store');
   expect(spy.mock.calls.some(x=>String(x[0]).includes('/manifests/'+chapterId+'.json'))).toBe(true);
 });
 it('proxies exactly the expected SHA-256 verified private image with no-store and nosniff',async()=>{
   const spy=await setup();
   const response=await request('page',String(pageParams));
   expect(response.status).toBe(200);
   expect(response.headers.get('Content-Type')).toBe('image/png');
   expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
   expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
   expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
   expect(spy.mock.calls.some(x=>String(x[0]).includes('/assets/'+file))).toBe(true);
 });
 it('reuses verified catalogue and manifest by immutable SHA but still checks every owner request',async()=>{
   const spy=await setup();
   expect((await request('manifest',String(params))).status).toBe(200);
   expect((await request('page',String(pageParams))).status).toBe(200);
   expect((await request('page',String(pageParams))).status).toBe(200);
   const urls=spy.mock.calls.map(call=>String(call[0]));
   expect(urls.filter(url=>url.includes('/catalogue.json'))).toHaveLength(1);
   expect(urls.filter(url=>url.includes('/manifests/'+chapterId+'.json'))).toHaveLength(1);
   expect(urls.filter(url=>url.includes('/assets/'+file))).toHaveLength(2);
   expect(urls.filter(url=>url.endsWith('/api/datasets/'+REPO))).toHaveLength(3);
   expect((await request('page',String(pageParams),false)).status).toBe(401);
   expect(spy.mock.calls.map(call=>String(call[0])).filter(url=>
     url.includes('/assets/'+file))).toHaveLength(2);
 });
 it('downloads canonical imported chapter pages without redundant HF metadata calls',async()=>{
   clearPrivateMediaMetadataCacheForTests();
   const query=new URLSearchParams({
     mangaId:id,chapterId,pageId,revision:sha,
     sha256:await digest(),mimeType:'image/png',
     byteSize:String(png.byteLength),extension:'png',
   });
   const spy=vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
     const url=String(input);
     if(url.includes('/resolve/'+sha+'/data/'+file))
       return new Response(png.slice().buffer,{status:200});
     throw Error('Unexpected metadata lookup on canonical page: '+url);
   });
   expect((await request('page',String(query),false)).status).toBe(401);
   expect(spy).not.toHaveBeenCalled();
   const image=await request('page',String(query));
   expect(image.status).toBe(200);
   expect(image.headers.get('Cache-Control')).toContain('no-store');
   expect(new Uint8Array(await image.arrayBuffer())).toEqual(png);
   expect(spy.mock.calls).toHaveLength(1);
   const bad=new URLSearchParams(query);
   bad.set('sha256','f'.repeat(64));
   expect((await request('page',String(bad))).status).toBe(409);
   bad.set('extension','../secret');
   expect((await request('page',String(bad))).status).toBe(400);
 });
 it('rejects a wrong revision, image identity or tampered image',async()=>{
   await setup();
   const wrong=new URLSearchParams(pageParams);wrong.set('revision','a'.repeat(40));
   expect((await request('page',String(wrong))).status).toBe(409);
   wrong.set('revision',sha);wrong.set('pageId','pg_'+'f'.repeat(24));
   expect((await request('page',String(wrong))).status).toBe(404);
   vi.restoreAllMocks();
   await setup({hash:'f'.repeat(64)});
   expect((await request('page',String(pageParams))).status).toBe(409);
 });
 it('never treats a missing or unverified image as readable',async()=>{
   await setup({missing:true});
   expect((await request('page',String(pageParams))).status).toBe(502);
 });
 const coverSamples=[
   {suffix:'png',mime:'image/png',bytes:Uint8Array.from([137,80,78,71,13,10,26,10,0,1,2,3])},
   {suffix:'jpg',mime:'image/jpeg',bytes:Uint8Array.from([255,216,255,224,0,16,0,1])},
   {suffix:'webp',mime:'image/webp',bytes:Uint8Array.from([82,73,70,70,8,0,0,0,87,69,66,80,86,80,56,32])},
   {suffix:'avif',mime:'image/avif',bytes:Uint8Array.from([0,0,0,16,102,116,121,112,97,118,105,102])},
 ];
 it('serves only verified original cover types from private immutable HF data',async()=>{
   const query=new URLSearchParams({mangaId:id}).toString();
   for(const sample of coverSamples){
     // Each fixture simulates a different immutable HF revision despite the reused fake SHA.
     clearPrivateMediaMetadataCacheForTests();
     const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',sample.bytes.buffer))]
       .map(x=>x.toString(16).padStart(2,'0')).join('');
     const cover={assetPath:'covers/'+id+'.'+sample.suffix,mimeType:sample.mime,
       width:20,height:20,byteSize:sample.bytes.length,sha256:digest};
     const spy=vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
       const url=String(input);
       if(url.endsWith('/api/datasets/'+REPO))return Response.json({sha,private:true});
       if(url.includes('/data/library.json'))
         return Response.json({schemaVersion:1,mediaKind:'manga',entries:[{...entry,cover}]});
       if(url.includes('/data/'+cover.assetPath))
         return new Response(sample.bytes.slice().buffer,{status:200});
       throw Error('Unexpected remote request '+url);
     });
     expect((await request('cover',query,false)).status).toBe(401);
     const response=await request('cover',query);
     expect(response.status).toBe(200);
     expect(response.headers.get('Content-Type')).toBe(sample.mime);
     expect(response.headers.get('Cache-Control')).toContain('no-store');
     expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
     expect(new Uint8Array(await response.arrayBuffer())).toEqual(sample.bytes);
     // A repeat request revalidates the signed-in owner and current private SHA,
     // but need not download unchanged, checksum-verified cover bytes twice.
     const second=await request('cover',query);
     expect(second.status).toBe(200);
     expect(second.headers.get('Cache-Control')).toContain('no-store');
     expect(new Uint8Array(await second.arrayBuffer())).toEqual(sample.bytes);
     const urls=spy.mock.calls.map(call=>String(call[0]));
     expect(urls.filter(url=>url.includes('/data/'+cover.assetPath))).toHaveLength(1);
     expect(urls.filter(url=>url.endsWith('/api/datasets/'+REPO))).toHaveLength(2);
     expect((await request('cover',query,false)).status).toBe(401);
     expect(spy.mock.calls.map(call=>String(call[0]))
       .filter(url=>url.includes('/data/'+cover.assetPath))).toHaveLength(1);
     expect(spy.mock.calls.every(call=>!String(call[0]).includes('token='+token))).toBe(true);
     vi.restoreAllMocks();
   }
   expect((await request('cover','mangaId=..%2Fprivate')).status).toBe(400);
 });
 it('loads immutable catalogue-pinned covers in one private HF round trip',async()=>{
   clearPrivateMediaMetadataCacheForTests();
   const image=Uint8Array.from([137,80,78,71,13,10,26,10,0,1,2,3]);
   const expected=[...new Uint8Array(await crypto.subtle.digest('SHA-256',image.buffer))]
     .map(x=>x.toString(16).padStart(2,'0')).join('');
   const query=new URLSearchParams({
     mangaId:id,revision:sha,sha256:expected,mimeType:'image/png',
     byteSize:String(image.length),extension:'png',
   });
   const spy=vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
     const url=String(input);
     if(url.includes('/resolve/'+sha+'/data/covers/'+id+'.png'))
       return new Response(image.slice().buffer,{status:200});
     throw Error('Redundant Hugging Face request on pinned cover: '+url);
   });
   expect((await request('cover',String(query),false)).status).toBe(401);
   expect(spy).not.toHaveBeenCalled();
   const first=await request('cover',String(query));
   expect(first.status).toBe(200);
   expect(first.headers.get('Cache-Control')).toContain('no-store');
   expect(new Uint8Array(await first.arrayBuffer())).toEqual(image);
   expect((await request('cover',String(query))).status).toBe(200);
   expect(spy.mock.calls).toHaveLength(1);
   expect(spy.mock.calls.every(call=>!String(call[0]).includes('/api/datasets/'))).toBe(true);
   const tampered=new URLSearchParams(query);
   tampered.set('sha256','f'.repeat(64));
   expect((await request('cover',String(tampered))).status).toBe(409);
   const invalid=new URLSearchParams(query);
   invalid.set('extension','../secret');
   expect((await request('cover',String(invalid))).status).toBe(400);
 });
 it('rejects missing and tampered private cover artwork',async()=>{
   const image=coverSamples[0]!.bytes,hash='f'.repeat(64);
   const cover={assetPath:'covers/'+id+'.png',mimeType:'image/png',
     width:20,height:20,byteSize:image.length,sha256:hash};
   const query=new URLSearchParams({mangaId:id}).toString();
   vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
     const url=String(input);
     if(url.endsWith('/api/datasets/'+REPO))return Response.json({sha,private:true});
     if(url.includes('/data/library.json'))return Response.json({
       schemaVersion:1,mediaKind:'manga',entries:[{...entry,cover}]});
     if(url.includes('/data/'+cover.assetPath))
       return new Response(image.slice().buffer);
     throw Error('Unexpected remote request '+url);
   });
   expect((await request('cover',query)).status).toBe(409);
   vi.restoreAllMocks();
   vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
     const url=String(input);
     if(url.endsWith('/api/datasets/'+REPO))return Response.json({sha,private:true});
     if(url.includes('/data/library.json'))return Response.json({
       schemaVersion:1,mediaKind:'manga',entries:[{...entry,cover}]});
     if(url.includes('/data/'+cover.assetPath))return new Response('',{status:404});
     throw Error('Unexpected remote request '+url);
   });
   expect((await request('cover',query)).status).toBe(502);
 });
 it('denies media when the supposed dataset is public',async()=>{
   await setup({private:false});
   expect((await request('manifest',String(params))).status).toBe(403);
 });
});
