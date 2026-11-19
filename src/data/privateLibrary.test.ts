import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchPrivateLibrary} from '../data/privateLibrary';
import {demoEntries} from '../data/fixtures';
afterEach(()=>vi.restoreAllMocks());
describe('browser private catalogue connection',()=>{
 it('does not assume a cloud session exists',async()=>{
   const spy=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:401}));
   expect(await fetchPrivateLibrary()).toMatchObject({status:'disconnected'});
   expect(spy).toHaveBeenCalledTimes(1);
 });
 it('reports missing runtime configuration without fetching an invented catalogue',async()=>{
   const spy=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:503}));
   expect(await fetchPrivateLibrary()).toMatchObject({status:'unconfigured'});
   expect(spy).toHaveBeenCalledTimes(1);
 });
 it('loads an authenticated empty private dataset without exposing access tokens',async()=>{
   const spy=vi.spyOn(globalThis,'fetch')
     .mockResolvedValueOnce(Response.json({connected:true,owner:'AdityaSreevatsaK'}))
     .mockResolvedValueOnce(Response.json({connected:true,repo:'AdityaSreevatsaK/Taiyous-Manga',entries:[]}));
   expect(await fetchPrivateLibrary()).toEqual({status:'connected',
     owner:'AdityaSreevatsaK',repo:'AdityaSreevatsaK/Taiyous-Manga',entries:[]});
   expect(spy).toHaveBeenCalledTimes(2);
   expect(spy.mock.calls.every((call)=>String(call[0]).startsWith('/api/'))).toBe(true);
   expect(spy.mock.calls.every((call)=>call[1]?.credentials==='same-origin')).toBe(true);
 });
 it('validates catalogue metadata at the browser boundary',async()=>{
   vi.spyOn(globalThis,'fetch')
     .mockResolvedValueOnce(Response.json({connected:true,owner:'AdityaSreevatsaK'}))
     .mockResolvedValueOnce(Response.json({connected:true,repo:'AdityaSreevatsaK/Taiyous-Manga',entries:demoEntries}));
   expect(await fetchPrivateLibrary()).toMatchObject({status:'connected',entries:demoEntries});
 });
 it('rejects forged account, wrong repo and invalid catalogue',async()=>{
   vi.spyOn(globalThis,'fetch')
     .mockResolvedValueOnce(Response.json({connected:true,owner:'OtherUser'}));
   expect(await fetchPrivateLibrary()).toMatchObject({status:'unavailable'});
   vi.restoreAllMocks();
   vi.spyOn(globalThis,'fetch')
     .mockResolvedValueOnce(Response.json({connected:true,owner:'AdityaSreevatsaK'}))
     .mockResolvedValueOnce(Response.json({connected:true,repo:'other/repo',entries:[]}));
   expect(await fetchPrivateLibrary()).toMatchObject({status:'unavailable'});
   vi.restoreAllMocks();
   vi.spyOn(globalThis,'fetch')
     .mockResolvedValueOnce(Response.json({connected:true,owner:'AdityaSreevatsaK'}))
     .mockResolvedValueOnce(Response.json({connected:true,repo:'AdityaSreevatsaK/Taiyous-Manga',
       entries:[{title:'unverified and incomplete'}]}));
   expect(await fetchPrivateLibrary()).toMatchObject({status:'unavailable'});
 });
});
