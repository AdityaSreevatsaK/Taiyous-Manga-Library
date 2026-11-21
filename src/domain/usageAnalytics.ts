/** Private device-local engagement journal. Timings estimate focused, non-idle time. */
const KEY='taiyou-manga:usage:v1',ID=/^[A-Za-z0-9_-]{1,128}$/;
const MAX=30*365*24*3600000,MAX_EVENTS=500,MAX_DAYS=400;
export type MangaActivity='chapter-opened'|'page-viewed'|'chapter-completed'|'chapter-reopened'|'shelf-changed'|'personal-edit';
export type MangaUsageEvent={at:string;mangaId:string;kind:MangaActivity;chapterId?:string;page?:number;detail?:string};
export type MangaUsageDay={appMs:number;readingMs:number;offlineMs:number};
export interface MangaUsage {version:1;enabled:boolean;days:Record<string,MangaUsageDay>;
  mangaReadingMs:Record<string,number>;events:MangaUsageEvent[]}
export const emptyMangaUsage=(enabled=true):MangaUsage=>({version:1,enabled,days:{},mangaReadingMs:{},events:[]});
const ms=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?Math.min(MAX,Math.max(0,Math.round(n))):0;
export function mangaLocalDay(d=new Date()):string {
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
const actions:readonly MangaActivity[]=['chapter-opened','page-viewed','chapter-completed','chapter-reopened','shelf-changed','personal-edit'];
export function readMangaUsage():MangaUsage {
  try {
    const raw=window.localStorage.getItem(KEY),d:unknown=raw?JSON.parse(raw):null;
    if(!d||typeof d!=='object'||Array.isArray(d)||(d as {version?:number}).version!==1)return emptyMangaUsage();
    const input=d as Partial<MangaUsage>,u=emptyMangaUsage(input.enabled!==false);
    if(input.days&&typeof input.days==='object'&&!Array.isArray(input.days))
      for(const k of Object.keys(input.days).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-MAX_DAYS)){
        const v=input.days[k];if(!v||typeof v!=='object')continue;
        u.days[k]={appMs:ms(v.appMs),readingMs:ms(v.readingMs),offlineMs:ms(v.offlineMs)};
      }
    if(input.mangaReadingMs&&typeof input.mangaReadingMs==='object'&&!Array.isArray(input.mangaReadingMs))
      for(const id of Object.keys(input.mangaReadingMs).filter(k=>ID.test(k)).slice(0,2500))
        u.mangaReadingMs[id]=ms(input.mangaReadingMs[id]);
    if(Array.isArray(input.events))
      for(const e of input.events.slice(-MAX_EVENTS)){
        if(!e||typeof e!=='object'||!ID.test(e.mangaId)||!actions.includes(e.kind)||
          typeof e.at!=='string'||!Number.isFinite(Date.parse(e.at)))continue;
        const event:MangaUsageEvent={at:new Date(e.at).toISOString(),mangaId:e.mangaId,kind:e.kind};
        if(e.chapterId&&ID.test(e.chapterId))event.chapterId=e.chapterId;
        if(Number.isSafeInteger(e.page)&&e.page>=1&&e.page<=100000)event.page=e.page;
        if(typeof e.detail==='string')event.detail=e.detail.slice(0,80);
        u.events.push(event);
      }
    return u;
  }catch{return emptyMangaUsage();}
}
function save(u:MangaUsage):void{try{window.localStorage.setItem(KEY,JSON.stringify(u));}
  catch{/* Quota errors never interrupt a chapter. */}}
function notify():void{if(typeof window!=='undefined')window.dispatchEvent(new Event('taiyou-manga-usage-changed'));}
export function setMangaUsageEnabled(enabled:boolean):MangaUsage{
  const u=readMangaUsage();u.enabled=enabled;save(u);notify();return u;
}
export function clearMangaUsage():MangaUsage{
  const u=emptyMangaUsage(readMangaUsage().enabled);save(u);notify();return u;
}
export function recordMangaUsage(elapsed:number,mangaId:string|null,offline:boolean,now=new Date()):MangaUsage{
  const u=readMangaUsage(),slice=Math.min(30000,ms(elapsed));
  if(!u.enabled||!slice)return u;
  const key=mangaLocalDay(now),d=u.days[key]??{appMs:0,readingMs:0,offlineMs:0};
  d.appMs=ms(d.appMs+slice);if(offline)d.offlineMs=ms(d.offlineMs+slice);
  if(mangaId&&ID.test(mangaId)){
    d.readingMs=ms(d.readingMs+slice);
    u.mangaReadingMs[mangaId]=ms((u.mangaReadingMs[mangaId]??0)+slice);
  }
  u.days[key]=d;
  for(const key of Object.keys(u.days).sort().slice(0,-MAX_DAYS))delete u.days[key];
  save(u);notify();return u;
}
export function recordMangaAction(input:Omit<MangaUsageEvent,'at'>,now=new Date()):void{
  if(!ID.test(input.mangaId)||!actions.includes(input.kind))return;
  const u=readMangaUsage();if(!u.enabled)return;
  const e:MangaUsageEvent={at:now.toISOString(),mangaId:input.mangaId,kind:input.kind};
  if(input.chapterId&&ID.test(input.chapterId))e.chapterId=input.chapterId;
  if(typeof input.page==='number'&&Number.isSafeInteger(input.page)&&input.page>=1&&input.page<=100000)e.page=input.page;
  if(input.detail)e.detail=input.detail.slice(0,80);
  const prev=u.events.at(-1);
  if(prev&&prev.mangaId===e.mangaId&&prev.kind===e.kind&&prev.chapterId===e.chapterId&&
    prev.page===e.page&&prev.detail===e.detail&&now.getTime()-Date.parse(prev.at)<30000)return;
  u.events.push(e);u.events=u.events.slice(-MAX_EVENTS);save(u);notify();
}
export function mangaDuration(value:number):string{
  const m=Math.floor(Math.max(0,value)/60000);if(m<1)return '<1 min';
  const h=Math.floor(m/60);return h?h+'h '+(m%60)+'m':m+' min';
}
export function installMangaUsageTracker(context:()=>{mangaId:string|null;online:boolean}):()=>void{
  let last=Date.now(),active=Date.now();
  const tick=()=>{
    const now=Date.now(),delta=now-last;last=now;
    if(delta<=0||delta>30000||document.visibilityState!=='visible'||
      !document.hasFocus()||now-active>180000)return;
    const {mangaId,online}=context();recordMangaUsage(delta,mangaId,!online,new Date(now));
  };
  const interact=()=>{tick();active=Date.now();};
  const interval=window.setInterval(tick,10000);
  const listeners:Array<[EventTarget,string,EventListenerOrEventListenerObject,AddEventListenerOptions?]>=[
    [document,'pointerdown',interact],[document,'keydown',interact],
    [document,'scroll',interact,{capture:true,passive:true}],
    [document,'wheel',interact,{passive:true}],[document,'touchstart',interact,{passive:true}],
    [window,'focus',interact],[window,'blur',tick],
    [window,'online',tick],[window,'offline',tick],
    [document,'visibilitychange',tick],[window,'pagehide',tick]
  ];
  for(const [target,name,fn,opts]of listeners)target.addEventListener(name,fn,opts);
  return ()=>{tick();window.clearInterval(interval);
    for(const [target,name,fn,opts]of listeners)target.removeEventListener(name,fn,opts);};
}
