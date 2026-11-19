import {ORIGIN,REPO,CALLBACK,SESSION,FLOW,HEADERS,configured,production,random,challenge,
 flowCookie,getFlow,sessionCookie,getSession,clear,redirect,json,privateRepo,accountOwner,
 type Env} from '../../_lib/mangaAuth';

interface Context{request:Request;env:Env}
function errorRedirect(code:string){return redirect(ORIGIN+'/?oauth_error='+code,[clear(FLOW)]);}
export async function onRequest({request,env}:Context):Promise<Response>{
 if(!production(request))return json({error:'Private authentication is production-only'},403);
 if(!configured(env))return json({error:'OAuth configuration is incomplete'},503);
 const action=new URL(request.url).pathname.split('/').at(-1);
 if(action==='login'&&request.method==='GET'){
   const state=random(32),verifier=random(48);
   const url=new URL('https://huggingface.co/oauth/authorize');
   url.searchParams.set('response_type','code');
   url.searchParams.set('client_id',env.HF_CLIENT_ID!);
   url.searchParams.set('redirect_uri',CALLBACK);
   url.searchParams.set('scope','openid profile read-repos');
   url.searchParams.set('state',state);
   url.searchParams.set('code_challenge',await challenge(verifier));
   url.searchParams.set('code_challenge_method','S256');
   return redirect(url.toString(),[await flowCookie({state,verifier,expires:Date.now()+600000},env)]);
 }
 if(action==='callback'&&request.method==='GET'){
   const query=new URL(request.url).searchParams;
   const flow=await getFlow(request,env);
   const code=query.get('code'),state=query.get('state');
   if(!flow||!state||state!==flow.state||!code||code.length>4096||query.has('error'))
     return errorRedirect('invalid_callback');
   try{
     const body=new URLSearchParams({grant_type:'authorization_code',client_id:env.HF_CLIENT_ID!,
       code,redirect_uri:CALLBACK,code_verifier:flow.verifier});
     // Confidential HF OAuth applications require HTTP Basic client authentication.
     const basic=btoa(env.HF_CLIENT_ID!+':'+env.HF_CLIENT_SECRET!);
     const upstream=await fetch('https://huggingface.co/oauth/token',{method:'POST',
       headers:{Authorization:'Basic '+basic,'Content-Type':'application/x-www-form-urlencoded'},
       body,cache:'no-store',signal:AbortSignal.timeout(15000)});
     if(!upstream.ok)return errorRedirect('exchange_failed');
     const token=await upstream.json() as {access_token?:unknown;expires_in?:unknown;scope?:unknown};
     if(typeof token.access_token!=='string'||!token.access_token.startsWith('hf_')||
       typeof token.expires_in!=='number'||!Number.isFinite(token.expires_in)||token.expires_in<1)
       return errorRedirect('exchange_failed');
     if(typeof token.scope!=='string'||!new Set(token.scope.split(/\s+/)).has('read-repos'))
       return errorRedirect('insufficient_scope');
     const username=await accountOwner(token.access_token,env);
     if(!username)return errorRedirect('wrong_account');
     if(!(await privateRepo(token.access_token)))return errorRedirect('dataset_access');
     const expires=Date.now()+Math.min(28800,token.expires_in)*1000;
     return redirect(ORIGIN+'/',[clear(FLOW),await sessionCookie({access:token.access_token,owner:username,expires},env)]);
   }catch{return errorRedirect('login_failed');}
 }
 if(action==='session'&&request.method==='GET'){
   const session=await getSession(request,env);
   if(!session)return json({connected:false},401);
   const repo=await privateRepo(session.access);
   if(!repo)return json({connected:false,error:'Private dataset inaccessible'},403);
   return json({connected:true,repo:REPO,owner:session.owner});
 }
 if(action==='logout'&&request.method==='POST'){
   if(request.headers.get('Origin')!==ORIGIN||
     request.headers.get('X-Taiyou-Request')!=='logout')return json({error:'Same-origin logout required'},403);
   const headers=new Headers({...HEADERS,'Content-Type':'application/json; charset=utf-8'});
   headers.append('Set-Cookie',clear(SESSION));headers.append('Set-Cookie',clear(FLOW));
   return new Response(JSON.stringify({connected:false}),{status:200,headers});
 }
 return json({error:'Not found'},404);
}
