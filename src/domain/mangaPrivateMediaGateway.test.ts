import {afterEach,describe,expect,it,vi} from 'vitest';
import {onRequest} from '../../functions/api/media/[kind]';
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
afterEach(()=>vi.restoreAllMocks());

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
 it('delivers only verified canonical private cover artwork using the owner session',async()=>{
   const webp=Uint8Array.from([82,73,70,70,8,0,0,0,87,69,66,80,86,80,56,32]);
   const coverHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',webp.buffer))]
     .map(x=>x.toString(16).padStart(2,'0')).join('');
   const full={...entry,coverAsset:{assetPath:'covers/'+id+'.webp',mimeType:'image/webp',
     byteSize:webp.byteLength,sha256:coverHash}};
   const spy=vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
     const url=String(input);
     if(url.endsWith('/api/datasets/'+REPO))return Response.json({sha,private:true});
     if(url.includes('/data/library.json'))
       return Response.json({schemaVersion:1,mediaKind:'manga',entries:[full]});
     if(url.includes('/data/covers/'+id+'.webp'))
       return new Response(webp.slice().buffer,{status:200});
     throw Error('Unexpected private provider request '+url);
   });
   const params=new URLSearchParams({mangaId:id}).toString();
   expect((await request('cover',params,false)).status).toBe(401);
   const response=await request('cover',params);
   expect(response.status).toBe(200);
   expect(response.headers.get('Content-Type')).toBe('image/webp');
   expect(response.headers.get('Cache-Control')).toContain('no-store');
   expect(response.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
   expect(new Uint8Array(await response.arrayBuffer())).toEqual(webp);
   expect(spy.mock.calls.some(call=>String(call[0]).includes('/data/covers/'+id+'.webp'))).toBe(true);
   expect(spy.mock.calls.every(call=>!String(call[0]).includes('token='+token))).toBe(true);
   expect((await request('cover','mangaId=..%2Fprivate')).status).toBe(400);
 });
 it('rejects tampered private covers instead of presenting them as verified',async()=>{
   const cover={assetPath:'covers/'+id+'.webp',mimeType:'image/webp',
     byteSize:16,sha256:'f'.repeat(64)};
   vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
     const url=String(input);
     if(url.endsWith('/api/datasets/'+REPO))return Response.json({sha,private:true});
     if(url.includes('/data/library.json'))return Response.json({
       schemaVersion:1,mediaKind:'manga',entries:[{...entry,coverAsset:cover}]});
     if(url.includes('/data/covers/'+id+'.webp'))
       return new Response(Uint8Array.from([82,73,70,70,8,0,0,0,87,69,66,80,86,80,56,32]).buffer);
     throw Error('Unexpected provider request '+url);
   });
   expect((await request('cover',new URLSearchParams({mangaId:id}).toString())).status).toBe(409);
 });
 it('denies media when the supposed dataset is public',async()=>{
   await setup({private:false});
   expect((await request('manifest',String(params))).status).toBe(403);
 });
});
