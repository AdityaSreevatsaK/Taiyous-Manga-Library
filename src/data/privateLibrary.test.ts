import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchPrivateLibrary} from '../data/privateLibrary';
import {demoEntries} from '../data/fixtures';
afterEach(()=>vi.restoreAllMocks());
const owner='AdityaSreevatsaK',repo='AdityaSreevatsaK/Taiyous-Manga';
describe('browser private catalogue connection',()=>{
 it('does not assume a cloud session exists',async()=>{
   const spy=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:401}));
   expect(await fetchPrivateLibrary()).toMatchObject({status:'disconnected'});
   expect(spy).toHaveBeenCalledExactlyOnceWith('/api/library',expect.objectContaining({
     credentials:'same-origin',cache:'no-store',
   }));
 });
 it('reports missing runtime configuration without fetching an invented catalogue',async()=>{
   const spy=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:503}));
   expect(await fetchPrivateLibrary()).toMatchObject({status:'unconfigured'});
   expect(spy).toHaveBeenCalledTimes(1);
 });
 it('loads an authenticated empty private dataset in one request without exposing tokens',async()=>{
   const spy=vi.spyOn(globalThis,'fetch').mockResolvedValue(
     Response.json({connected:true,owner,repo,entries:[]}));
   expect(await fetchPrivateLibrary()).toEqual({status:'connected',owner,repo,entries:[]});
   expect(spy).toHaveBeenCalledTimes(1);
   expect(spy.mock.calls[0]![0]).toBe('/api/library');
   expect(spy.mock.calls[0]![1]?.credentials).toBe('same-origin');
 });
 it('validates catalogue metadata at the browser boundary',async()=>{
   const spy=vi.spyOn(globalThis,'fetch').mockResolvedValue(
     Response.json({connected:true,owner,repo,entries:demoEntries}));
   expect(await fetchPrivateLibrary()).toMatchObject({status:'connected',entries:demoEntries});
   expect(spy).toHaveBeenCalledTimes(1);
 });
 it('rejects forged account, wrong repo and invalid catalogue',async()=>{
   for(const payload of [
     {connected:true,owner:'OtherUser',repo,entries:[]},
     {connected:true,owner,repo:'other/repo',entries:[]},
     {connected:true,repo,entries:[]},
     {connected:true,owner,repo,entries:[{title:'unverified and incomplete'}]},
   ]){
     vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json(payload));
     expect(await fetchPrivateLibrary()).toMatchObject({status:'unavailable'});
     vi.restoreAllMocks();
   }
 });
 it('preserves recovery messaging for invalid canonical catalogue',async()=>{
   vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:409}));
   expect(await fetchPrivateLibrary()).toMatchObject({
     status:'unavailable',message:expect.stringContaining('recovery'),
   });
 });
});
