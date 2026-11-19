import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const SOURCE = readFileSync(new URL('../public/sw.js', import.meta.url),'utf8');
const ORIGIN = 'https://demo.example/';
const PREFIX = 'taiyou-manga-shell-v1-';
function makeCaches() {
  const stores=new Map();
  const name=request=>typeof request==='string'?request:request.url;
  const caches={
    async keys(){return [...stores.keys()];},
    async delete(key){return stores.delete(key);},
    async open(key){
      if(!stores.has(key))stores.set(key,new Map());
      const data=stores.get(key);
      return {
        async put(request,response){data.set(name(request),response.clone());},
        async match(request){return data.get(name(request))?.clone();},
        async addAll(requests){
          for(const request of requests){
            const response=await caches.server.fetch(request);
            if(!response.ok)throw Error('Precache fetch failed '+name(request));
            data.set(name(request),response.clone());
          }
        },
      };
    },
    server:null,
  };
  return caches;
}
function server(version='one') {
  return {
    version,offline:false,failPath:'',
    async fetch(input) {
      if(this.offline)throw Error('Network unavailable');
      const url=new URL(typeof input==='string'?input:input.url);
      if(this.failPath&&url.pathname.endsWith(this.failPath))return new Response('error',{status:503});
      if(url.pathname==='/'){
        return new Response('<html><head><link rel="stylesheet" href="/assets/style-'+this.version+'.css"></head>'+
          '<body><script type="module" src="/assets/main-'+this.version+'.js"></script></body></html>',{
          status:200,headers:{'content-type':'text/html'}});
      }
      if(url.pathname.endsWith('.js'))return new Response('document.body.dataset.version="'+this.version+'";',{status:200});
      if(url.pathname.endsWith('.css'))return new Response('body{--release:"'+this.version+'"}',{status:200});
      return new Response('approved public art '+url.pathname,{status:200});
    },
  };
}
function worker(cacheStore,originServer,timestamp=1700000000000) {
  cacheStore.server=originServer;
  const events=new Map();
  class TestDate extends Date { static now(){return timestamp;} }
  const self={
    registration:{scope:ORIGIN},
    addEventListener(type,callback){events.set(type,callback);},
    async skipWaiting(){},
    clients:{async claim(){}},
  };
  runInNewContext(SOURCE,{URL,Response,Date:TestDate,self,caches:cacheStore,fetch:(...args)=>originServer.fetch(...args)});
  async function lifecycle(type) {
    let task;
    events.get(type)({waitUntil(value){task=value;}});
    assert.ok(task,'lifecycle task');
    return task;
  }
  async function request(path,mode='same-origin') {
    let task;
    const url=new URL(path,ORIGIN).href;
    events.get('fetch')({
      request:{method:'GET',url,mode},
      respondWith(value){task=value;},
    });
    assert.ok(task,'fetch should be intercepted for '+path);
    return task;
  }
  function intercepts(path,mode='navigate'){
    let called=false;
    events.get('fetch')({
      request:{method:'GET',url:new URL(path,ORIGIN).href,mode},
      respondWith(){called=true;},
    });
    return called;
  }
  return {lifecycle,request,intercepts};
}
async function readNames(caches){
  return (await caches.keys()).filter(name=>name.startsWith(PREFIX)).sort().reverse();
}
test('offline never serves a newer unverified or partially installed release',async()=>{
  const cache=makeCaches(),network=server('version-one'),w=worker(cache,network);
  await w.lifecycle('install');await w.lifecycle('activate');
  const [original]=await readNames(cache);
  assert.ok(original);
  const stage=await cache.open(PREFIX+'9999999999999');
  await stage.put(ORIGIN,new Response('<html>INCOMPLETE-NEW-HTML</html>'));
  await stage.put(ORIGIN+'assets/main-version-two.js',new Response('UNVERIFIED-JS'));
  network.offline=true;
  const fallback=await w.request('/library','navigate');
  assert.match(await fallback.text(),/version-one/);
  await assert.rejects(w.request('/assets/main-version-two.js'),/Network unavailable/);
  await w.lifecycle('activate');
  assert.deepEqual(await readNames(cache),[original]);
});
test('failed pre-cache preserves verified offline fallback, without leftover staged caches',async()=>{
  const cache=makeCaches(),old=server('version-one');
  const w1=worker(cache,old);
  await w1.lifecycle('install');await w1.lifecycle('activate');
  const [original]=await readNames(cache);
  const changed=server('version-two');changed.failPath='favicon-light.png';
  const w2=worker(cache,changed);
  await assert.rejects(w2.lifecycle('install'),/Precache fetch failed/);
  assert.deepEqual(await readNames(cache),[original]);
  changed.offline=true;
  const fallback=await w2.request('/library','navigate');
  assert.match(await fallback.text(),/version-one/);
});
test('two verified releases survive, including same-millisecond installs and rollback',async()=>{
  const cache=makeCaches();
  const first=worker(cache,server('one'),1700000000000);
  await first.lifecycle('install');await first.lifecycle('activate');
  const second=worker(cache,server('two'),1700000000000);
  await second.lifecycle('install');await second.lifecycle('activate');
  assert.equal((await readNames(cache)).length,2,'same-millisecond version must not overwrite verified cache');
  const network=server('three');
  const third=worker(cache,network,1700000000002);
  await third.lifecycle('install');await third.lifecycle('activate');
  let names=await readNames(cache);
  assert.equal(names.length,2,'only latest two verified shells are kept');
  network.offline=true;
  const newest=await third.request('/','navigate');
  assert.match(await newest.text(),/three/);
  await cache.delete(names[0]);
  const rollback=await third.request('/reading','navigate');
  assert.match(await rollback.text(),/two/);
  assert.deepEqual(await readNames(cache),[names[1]]);
});

test('service worker never intercepts private API or OAuth navigation',()=>{
  const cache=makeCaches(),network=server('one'),w=worker(cache,network);
  for(const path of ['/api/auth/login','/api/auth/callback?code=redacted',
    '/api/auth/session','/api/auth/logout','/api/library']){
    assert.equal(w.intercepts(path,'navigate'),false,path+' should bypass offline shell');
    assert.equal(w.intercepts(path,'same-origin'),false,path+' should bypass cache');
  }
  assert.equal(w.intercepts('/library','navigate'),true,'ordinary app route still works');
});
