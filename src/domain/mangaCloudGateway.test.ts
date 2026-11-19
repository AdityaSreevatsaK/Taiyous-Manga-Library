import {afterEach,describe,expect,it,vi} from 'vitest';
import {onRequest as oauth} from '../../functions/api/auth/[action]';
import {onRequest as library} from '../../functions/api/library';
import {ORIGIN,REPO,SESSION,configured,sessionCookie,type Env} from '../../functions/_lib/mangaAuth';

const env:Env={
 HF_REPO_ID:REPO,HF_OWNER_USERNAME:'AdityaSreevatsaK',
 HF_CLIENT_ID:'registered-test-client',HF_CLIENT_SECRET:'server-only-client-secret',
 SESSION_SECRET:btoa('a'.repeat(32)),
};
const token='hf_'+ 'a'.repeat(48);
const sha='b'.repeat(40);
const req=(path:string,init?:RequestInit)=>new Request(ORIGIN+path,init);
const asCookie=(response:Response,name:string)=>response.headers.get('Set-Cookie')?.split(';')[0]||'';
const fakeSession=async()=>sessionCookie({access:token,owner:'AdityaSreevatsaK',expires:Date.now()+3600000},env);
const api=async(path:string,cookie:string)=>{
 const request=req(path,{headers:{Cookie:cookie}});
 return library({request,env});
};
afterEach(()=>vi.restoreAllMocks());

describe('private Cloudflare OAuth read-only gateway',()=>{
 it('fails closed without correct secrets and dataset settings',async()=>{
   expect(configured(env)).toBe(true);
   expect(configured({...env,SESSION_SECRET:'invalid'})).toBe(false);
   expect(configured({...env,HF_REPO_ID:'someone/other'})).toBe(false);
   expect((await oauth({request:req('/api/auth/login'),env:{}})).status).toBe(503);
   expect((await library({request:req('/api/library'),env:{}})).status).toBe(503);
 });
 it('sends only signed PKCE flow cookie, code challenge and least-privilege scopes',async()=>{
   const response=await oauth({request:req('/api/auth/login'),env});
   expect(response.status).toBe(303);
   const url=new URL(response.headers.get('Location')!);
   expect(url.origin).toBe('https://huggingface.co');
   expect(url.searchParams.get('redirect_uri')).toBe(ORIGIN+'/api/auth/callback');
   expect(url.searchParams.get('scope')).toBe('openid profile read-repos');
   expect(url.searchParams.get('code_challenge_method')).toBe('S256');
   expect(url.searchParams.get('code_challenge')).toMatch(/^[a-zA-Z0-9_-]+$/);
   expect(response.headers.get('Set-Cookie')).toMatch(/Secure; HttpOnly; SameSite=Lax/);
   expect(response.headers.get('Set-Cookie')).not.toContain(env.HF_CLIENT_SECRET);
   expect(url.search).not.toContain(token);
 });
 it('rejects tampered OAuth state without exchanging a code',async()=>{
   const login=await oauth({request:req('/api/auth/login'),env});
   const cookie=asCookie(login,'flow');
   const spy=vi.spyOn(globalThis,'fetch');
   const result=await oauth({request:req('/api/auth/callback?state=forged&code=test-code',{headers:{Cookie:cookie}}),env});
   expect(result.status).toBe(303);
   expect(result.headers.get('Location')).toContain('invalid_callback');
   expect(spy).not.toHaveBeenCalled();
 });
 it('authenticates the exact private dataset owner and verifies empty dataset safely',async()=>{
   const login=await oauth({request:req('/api/auth/login'),env});
   const flowCookie=asCookie(login,'flow');
   const state=new URL(login.headers.get('Location')!).searchParams.get('state')!;
   const fetcher=vi.spyOn(globalThis,'fetch').mockImplementation(async (input,init)=>{
     const url=String(input);
     if(url.endsWith('/oauth/token')){
       expect(init?.headers).toMatchObject({Authorization:expect.stringMatching(/^Basic /)});
       expect(String(init?.body)).toContain('code_verifier=');
       return new Response(JSON.stringify({access_token:token,scope:'openid profile read-repos',expires_in:3600}),{status:200});
     }
     if(url.endsWith('/api/whoami-v2'))return Response.json({name:'AdityaSreevatsaK'});
     if(url.endsWith('/api/datasets/'+REPO))return Response.json({sha,private:true});
     if(url.includes('/data/library.json'))return new Response('',{status:404});
     if(url.includes('/tree/'+sha+'/data'))return new Response('',{status:404});
     throw Error('Unexpected provider request '+url);
   });
   const callback=await oauth({request:req('/api/auth/callback?code=demo-code&state='+state,{headers:{Cookie:flowCookie}}),env});
   expect(callback.status).toBe(303);
   expect(callback.headers.get('Location')).toBe(ORIGIN+'/');
   const sealed=callback.headers.get('Set-Cookie')!.match(/__Host-taiyou_manga_session=[^;]+/)?.[0];
   expect(sealed).toBeTruthy();
   expect(sealed).not.toContain(token);
   const status=await oauth({request:req('/api/auth/session',{headers:{Cookie:sealed!}}),env});
   expect(status.status).toBe(200);
   expect(await status.json()).toMatchObject({connected:true,repo:REPO,owner:'AdityaSreevatsaK'});
   const catalog=await api('/api/library',sealed!);
   expect(catalog.status).toBe(200);
   expect(await catalog.json()).toMatchObject({connected:true,empty:true,entries:[],revision:sha});
   expect(catalog.headers.get('Cache-Control')).toContain('no-store');
   expect(catalog.headers.get('Set-Cookie')).toBeNull();
   expect(fetcher).toHaveBeenCalled();
 });
 it('does not report an orphaned dataset as an empty library',async()=>{
   const cookie=await fakeSession();
   vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
     const url=String(input);
     if(url.endsWith('/api/datasets/'+REPO))return Response.json({private:true,sha});
     if(url.includes('/data/library.json'))return new Response('',{status:404});
     if(url.includes('/tree/'+sha+'/data'))return Response.json([{path:'data/manga/unindexed'}]);
     throw Error('unexpected '+url);
   });
   const result=await api('/api/library',cookie.split(';')[0]!);
   expect(result.status).toBe(409);
   expect((await result.json()).error).toContain('Recovery required');
 });
 it('rejects a corrupt or unsupported indexed catalogue instead of inventing content',async()=>{
   const cookie=await fakeSession();
   vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
     const url=String(input);
     if(url.endsWith('/api/datasets/'+REPO))return Response.json({private:true,sha});
     if(url.includes('/data/library.json'))
       return new Response(JSON.stringify({schemaVersion:2,mediaKind:'manga',entries:[]}),{status:200});
     throw Error('unexpected');
   });
   const result=await api('/api/library',cookie.split(';')[0]!);
   expect(result.status).toBe(409);
   expect((await result.json()).error).toContain('unsupported');
 });
 it('never fetches private provider data before owner authentication',async()=>{
   const spy=vi.spyOn(globalThis,'fetch');
   expect((await api('/api/library','')).status).toBe(401);
   expect(spy).not.toHaveBeenCalled();
   const wrong=await sessionCookie({access:token,owner:'unrelated-owner',expires:Date.now()+3600000},env);
   expect((await api('/api/library',wrong.split(';')[0]!)).status).toBe(401);
   expect(spy).not.toHaveBeenCalled();
 });
 it('requires same-origin custom header for sign-out',async()=>{
   const cookie=await fakeSession();
   const denied=await oauth({request:req('/api/auth/logout',{
     method:'POST',headers:{Cookie:cookie.split(';')[0]!,Origin:'https://evil.example',
       'X-Taiyou-Request':'logout'}}),env});
   expect(denied.status).toBe(403);
   const ok=await oauth({request:req('/api/auth/logout',{method:'POST',headers:{
     Cookie:cookie.split(';')[0]!,Origin:ORIGIN,'X-Taiyou-Request':'logout',
   }}),env});
   expect(ok.status).toBe(200);
   expect(ok.headers.get('Set-Cookie')).toContain('Max-Age=0');
 });
});
