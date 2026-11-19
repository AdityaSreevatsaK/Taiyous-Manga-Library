export const ORIGIN='https://taiyous-manga-library.pages.dev';
export const REPO='AdityaSreevatsaK/Taiyous-Manga';
export const CALLBACK=ORIGIN+'/api/auth/callback';
export const SESSION='__Host-taiyou_manga_session';
export const FLOW='__Host-taiyou_manga_flow';
const te=new TextEncoder(),td=new TextDecoder();
export interface Env{HF_REPO_ID?:string;HF_OWNER_USERNAME?:string;HF_CLIENT_ID?:string;HF_CLIENT_SECRET?:string;SESSION_SECRET?:string}
export interface SessionData{access:string;owner:string;expires:number}
export interface FlowData{state:string;verifier:string;expires:number}
export const HEADERS={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
const owner=(env:Env)=>env.HF_OWNER_USERNAME?.toLowerCase()===REPO.split('/')[0]!.toLowerCase();
function keyData(env:Env):Uint8Array|null{
 try{const input=env.SESSION_SECRET||'';if(!/^(?:[A-Za-z0-9+/]{43}=|[A-Za-z0-9+/]{44})$/.test(input))return null;
 const bytes=Uint8Array.from(atob(input),c=>c.charCodeAt(0));return bytes.length===32?bytes:null;}catch{return null;}
}
export function configured(env:Env):boolean{return env.HF_REPO_ID===REPO&&owner(env)&&!!keyData(env)&&
 typeof env.HF_CLIENT_ID==='string'&&env.HF_CLIENT_ID.length>5&&env.HF_CLIENT_ID.length<1024&&
 typeof env.HF_CLIENT_SECRET==='string'&&env.HF_CLIENT_SECRET.length>9&&env.HF_CLIENT_SECRET.length<4096;}
function b64(bytes:Uint8Array):string{let raw='';for(const b of bytes)raw+=String.fromCharCode(b);return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function from64(value:string):Uint8Array{if(!/^[A-Za-z0-9_-]{1,7000}$/.test(value))throw Error('cookie');
 return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));}
const key=async(env:Env)=>crypto.subtle.importKey('raw',keyData(env)!,'AES-GCM',false,['encrypt','decrypt']);
export const random=(n=32)=>b64(crypto.getRandomValues(new Uint8Array(n)));
export const challenge=async(v:string)=>b64(new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(v))));
export async function seal(data:unknown,env:Env,aad:string):Promise<string>{const iv=crypto.getRandomValues(new Uint8Array(12));
 const crypt=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:te.encode(aad)},await key(env),te.encode(JSON.stringify(data))));
 const payload=new Uint8Array(iv.length+crypt.length);payload.set(iv);payload.set(crypt,iv.length);return b64(payload);}
export async function unseal<T>(text:string,env:Env,aad:string):Promise<T|null>{try{const bytes=from64(text);if(bytes.length<29)return null;
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:te.encode(aad)},await key(env),bytes.slice(12));
 return JSON.parse(td.decode(plain)) as T;}catch{return null;}}
const cv=(req:Request,name:string)=>(req.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
const cookie=(name:string,value:string,seconds:number)=>name+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+Math.max(0,Math.floor(seconds));
export const clear=(name:string)=>cookie(name,'',0);
export const flowCookie=async(flow:FlowData,env:Env)=>cookie(FLOW,await seal(flow,env,'manga-flow:v1'),600);
export async function getFlow(req:Request,env:Env):Promise<FlowData|null>{const v=await unseal<FlowData>(cv(req,FLOW),env,'manga-flow:v1');
 return v&&typeof v.state==='string'&&v.state.length>=30&&typeof v.verifier==='string'&&v.verifier.length>=40&&
 typeof v.expires==='number'&&v.expires>Date.now()?v:null;}
export const sessionCookie=async(s:SessionData,env:Env)=>cookie(SESSION,await seal(s,env,'manga-session:v1'),Math.min(28800,Math.max(1,(s.expires-Date.now())/1000)));
export async function getSession(req:Request,env:Env):Promise<SessionData|null>{if(!configured(env))return null;
 const s=await unseal<SessionData>(cv(req,SESSION),env,'manga-session:v1');return s&&typeof s.owner==='string'&&s.owner.toLowerCase()===env.HF_OWNER_USERNAME!.toLowerCase()&&
 typeof s.access==='string'&&s.access.startsWith('hf_')&&s.access.length<4500&&typeof s.expires==='number'&&
 Number.isFinite(s.expires)&&s.expires>Date.now()&&s.expires<=Date.now()+28801000?s:null;}
export const production=(r:Request)=>new URL(r.url).origin===ORIGIN;
export function json(value:unknown,status=200):Response{return new Response(JSON.stringify(value),{status,headers:{...HEADERS,'Content-Type':'application/json; charset=utf-8'}});}
export function redirect(to:string,cookies:string[]=[]):Response{const headers=new Headers({...HEADERS,Location:to});for(const c of cookies)headers.append('Set-Cookie',c);return new Response(null,{status:303,headers});}
export async function hfFetch(path:string,token:string):Promise<Response>{return fetch('https://huggingface.co'+path,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(15000)});}
export async function privateRepo(token:string):Promise<{sha:string}|null>{try{const r=await hfFetch('/api/datasets/'+REPO,token);
 if(!r.ok)return null;const info=await r.json() as {private?:unknown;sha?:unknown};
 return info.private===true&&typeof info.sha==='string'&&/^[a-f0-9]{40}$/.test(info.sha)?{sha:info.sha}:null;}catch{return null;}}
export async function accountOwner(token:string,env:Env):Promise<string|null>{try{const r=await hfFetch('/api/whoami-v2',token);
 if(!r.ok)return null;const info=await r.json() as {name?:unknown};
 return typeof info.name==='string'&&info.name.toLowerCase()===env.HF_OWNER_USERNAME!.toLowerCase()?info.name:null;}catch{return null;}}
