/** Same-origin, short-lived Master grant. Tokens and owner passphrase never enter URLs. */
export interface MangaMasterStatus{configured:boolean;unlocked:boolean;writeScope:boolean}
export interface MangaMetadataPatch{
 mangaId:string;revision:string;title?:string;creators?:string[];
 publicationStatus?:'unknown'|'ongoing'|'completed'|'hiatus'|'dropped';
}
async function requestMaster(action:string,body?:unknown):Promise<Record<string,unknown>>{
 const response=await fetch('/api/master?action='+encodeURIComponent(action),{
   credentials:'same-origin',cache:'no-store',
   ...(body===undefined?{}:{method:'POST',
     headers:{'Content-Type':'application/json','X-Taiyou-Request':'master-controls'},
     body:JSON.stringify(body)}),
 });
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok){
   const message=data&&typeof data==='object'&&'error' in data?
     (data as {error?:unknown}).error:null;
   throw Error(typeof message==='string'?message:'Master Controls request failed.');
 }
 return (data&&typeof data==='object'&&!Array.isArray(data))?data as Record<string,unknown>:{};
}
const decode=(v:Record<string,unknown>):MangaMasterStatus=>({
 configured:v.configured===true,unlocked:v.unlocked===true,writeScope:v.writeScope===true,
});
export async function getMangaMasterStatus():Promise<MangaMasterStatus>{
 return decode(await requestMaster('status'));
}
export async function unlockMangaMaster(passphrase:string):Promise<MangaMasterStatus>{
 return decode(await requestMaster('unlock',{passphrase}));
}
export async function lockMangaMaster():Promise<void>{await requestMaster('lock',{});}
export async function saveMangaPublication(patch:MangaMetadataPatch):Promise<void>{
 const result=await requestMaster('update-metadata',patch);
 if(result.saved!==true)throw Error('Hugging Face did not confirm the metadata save.');
}
