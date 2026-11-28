import {describe,expect,it} from 'vitest';
import {journalRequest} from '../../functions/_lib/journal';
import {ORIGIN,REPO,sessionCookie} from '../../functions/_lib/mangaAuth';
const env={HF_REPO_ID:REPO,HF_OWNER_USERNAME:'AdityaSreevatsaK',HF_CLIENT_ID:'synthetic-client',
 HF_CLIENT_SECRET:'synthetic-secret',SESSION_SECRET:btoa('x'.repeat(32))};
async function cookie(owner='AdityaSreevatsaK',expires=Date.now()+60000){
 return (await sessionCookie({owner,access:'hf_synthetic',expires,scope:'openid profile read-repos'},env)).split(';')[0]!;
}
describe('Journal authentication and request boundary',()=>{
 it('fails closed for preview hosts and unauthenticated requests',async()=>{
   expect((await journalRequest({request:new Request('https://preview.example/api/journal'),env})).status).toBe(403);
   const r=await journalRequest({request:new Request(ORIGIN+'/api/journal'),env});
   expect(r.status).toBe(401);expect(r.headers.get('Cache-Control')).toContain('no-store');
 });
 it('rejects wrong owner and expired session',async()=>{
   for(const value of [await cookie('other'),await cookie('AdityaSreevatsaK',Date.now()-1)]){
    expect((await journalRequest({request:new Request(ORIGIN+'/api/journal',{headers:{Cookie:value}}),env})).status).toBe(401);
   }
 });
 it('requires same-origin JSON marker for mutations and reports absent binding',async()=>{
   const headers={Cookie:await cookie(),'Content-Type':'application/json','X-Taiyou-Request':'journal'};
   expect((await journalRequest({request:new Request(ORIGIN+'/api/journal',{method:'POST',headers:{...headers,Origin:'https://foreign.example'},body:'{}'}),env})).status).toBe(403);
   expect((await journalRequest({request:new Request(ORIGIN+'/api/journal',{method:'POST',headers:{...headers,Origin:ORIGIN},body:'{}'}),env})).status).toBe(503);
   expect((await journalRequest({request:new Request(ORIGIN+'/api/journal',{headers}),env})).status).toBe(503);
 });
});
